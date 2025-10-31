// src/Data/Repositories/discoveryRepositoryMongo.ts
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import UserModel from '../Model/userModel.js';
import { LikeModel, MatchModel, SeenModel } from '../Model/discoveryModel.js';

/**
 * NOTE:
 * - We call `.lean()` in many places for performance (returns plain objects).
 * - Comparing ObjectIds from lean results: convert both sides to string before comparing.
 */

type MaybeObjectId = Types.ObjectId | string | undefined;

export default class DiscoveryRepository {
    async fetchProfilesForViewer(
        viewerId: string,
        opts: {
            minAge?: number;
            maxAge?: number;
            lat?: number;
            lon?: number;
            maxDistanceKm?: number;
            limit?: number;
            page?: number;
        }
    ) {
        const { minAge = 18, maxAge = 99, lat, lon, maxDistanceKm = 50, limit = 20, page = 0 } = opts;

        const match: any = {
            _id: { $ne: new Types.ObjectId(viewerId) },
            age: { $gte: minAge, $lte: maxAge },
        };

        // exclude already seen
        const seen = await SeenModel.find({ viewerId }).select('seenUserId').lean();
        if (seen.length > 0) match._id.$nin = seen.map((s: any) => s.seenUserId);

        // optional geo filter
        if (typeof lat === 'number' && typeof lon === 'number') {
            match.location = {
                $near: {
                    $geometry: { type: 'Point', coordinates: [lon, lat] },
                    $maxDistance: Math.round(maxDistanceKm * 1000),
                },
            };
        }

        const projection = { name: 1, age: 1, bio: 1, profilePicture: 1, personality: 1, tags: 1, location: 1 };

        const docs = await UserModel.find(match, projection)
            .skip(page * limit)
            .limit(limit)
            .lean();

        return docs; // array of plain objects
    }

    async like(likerId: string, likedId: string) {
        if (likerId === likedId) throw new Error('Cannot like yourself');

        const likerObj = new Types.ObjectId(likerId);
        const likedObj = new Types.ObjectId(likedId);
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            // create like idempotently
            try {
                await LikeModel.create([{ likerId: likerObj, likedId: likedObj }], { session });
            } catch (e: any) {
                // duplicate key -> already liked -> ignore
                if (!(e && e.code === 11000)) throw e;
            }

            // upsert seen record
            await SeenModel.updateOne(
                { viewerId: likerObj, seenUserId: likedObj },
                { $set: { action: 'like', createdAt: new Date() } },
                { upsert: true, session }
            );

            // check reverse like
            const reverse = await LikeModel.findOne({ likerId: likedObj, likedId: likerObj }).session(session).lean();

            if (reverse) {
                // canonical ordering to avoid duplicate match permutations
                const [userA, userB] =
                    likerObj.toString() < likedObj.toString() ? [likerObj, likedObj] : [likedObj, likerObj];

                try {
                    const match = await MatchModel.create([{ userA, userB }], { session });
                    await session.commitTransaction();
                    // match[0] will be Mongoose document (not lean because create returns doc)
                    return { matched: true, match: match[0] };
                } catch (e: any) {
                    // duplicate match error -> someone else created it concurrently
                    if (e && e.code === 11000) {
                        await session.commitTransaction();
                        // fetch existing match as plain object
                        const existing = await MatchModel.findOne({
                            $or: [{ userA, userB }, { userA: userB, userB: userA }],
                        }).lean();
                        return { matched: true, match: existing };
                    }
                    throw e;
                }
            } else {
                await session.commitTransaction();
                return { matched: false };
            }
        } catch (err) {
            await session.abortTransaction();
            throw err;
        } finally {
            session.endSession();
        }
    }

    async skip(viewerId: string, skipId: string) {
        const viewerObj = new Types.ObjectId(viewerId);
        const skipObj = new Types.ObjectId(skipId);

        // Log this user action (optional)
        await SeenModel.updateOne(
            { viewerId: viewerObj, seenUserId: skipObj },
            { $set: { action: 'skip', createdAt: new Date() } },
            { upsert: true }
        );

        // NEW: Delete any existing "like" relationship between these two users
        // - Case 1: viewer previously liked skipId
        // - Case 2: skipId previously liked viewer
        await LikeModel.deleteMany({
            $or: [
                { likerId: viewerObj, likedId: skipObj },
                { likerId: skipObj, likedId: viewerObj },
            ],
        });

        // Optional: Also delete any existing "match" (unmatch scenario)
        await MatchModel.deleteMany({
            $or: [
                { userA: viewerObj, userB: skipObj },
                { userA: skipObj, userB: viewerObj },
            ],
        });

        return { ok: true, message: 'Like or match removed successfully' };
    }


    async getMatchesForUser(userId: string) {
        const idObj = new Types.ObjectId(userId);

        // find matches (lean -> plain objects)
        const matches = await MatchModel.find({ $or: [{ userA: idObj }, { userB: idObj }] }).lean();

        // collect partnerIds as string
        const partnerIds: string[] = matches.map((m: any) => {
            const userA: MaybeObjectId = m.userA;
            const userB: MaybeObjectId = m.userB;
            // convert both to string and pick the one that's not equal to the requester
            const userAStr = userA ? String(userA) : '';
            const userBStr = userB ? String(userB) : '';
            return userAStr === String(idObj) ? userBStr : userAStr;
        });

        // fetch partner profiles
        const partnerObjectIds = partnerIds.map(pid => new Types.ObjectId(pid));
        const users = await UserModel.find({ _id: { $in: partnerObjectIds } }, { name: 1, profilePicture: 1, age: 1 }).lean();

        // map each match to its partner profile
        const res = matches.map((m: any) => {
            const userA = String(m.userA);
            const userB = String(m.userB);
            const partnerId = userA === String(idObj) ? userB : userA;
            const partner = users.find((u: any) => String(u._id) === partnerId);
            return { match: m, partner };
        });

        return res;
    }

    /**
     * Return list of profiles who liked the current user but are NOT yet matched.
     * Each item is a plain object of the liker user's profile.
     */
    async getLikesReceivedForUser(userId: string) {
        const likedObj = new Types.ObjectId(userId);

        // find likes where likedId == current user
        const likes = await LikeModel.find({ likedId: likedObj }).lean();

        if (!likes || likes.length === 0) return [];

        // collect unique likerIds as strings
        const likerIds = Array.from(new Set(likes.map((l: any) => String(l.likerId))));

        // find matches involving current user and any of the likerIds
        const likerObjectIds = likerIds.map(id => new Types.ObjectId(id));
        const matches = await MatchModel.find({
            $or: [
                { userA: { $in: likerObjectIds }, userB: likedObj },
                { userB: { $in: likerObjectIds }, userA: likedObj },
            ],
        }).lean();

        // build set of matched partner ids (strings) so we exclude them
        const matchedSet = new Set<string>();
        matches.forEach((m: any) => {
            const a = String(m.userA);
            const b = String(m.userB);
            if (a === String(likedObj)) matchedSet.add(b);
            else if (b === String(likedObj)) matchedSet.add(a);
        });

        // filter likerIds to only those not matched
        const pendingLikerObjectIds = likerIds.filter(id => !matchedSet.has(id)).map(id => new Types.ObjectId(id));

        if (pendingLikerObjectIds.length === 0) return [];

        // fetch minimal profile fields for each liker
        const users = await UserModel.find(
            { _id: { $in: pendingLikerObjectIds } },
            { name: 1, profilePicture: 1, age: 1, bio: 1, tags: 1, location: 1 }
        ).lean();

        return users;
    }



    async declineReceivedLike(currentUserId: string, likerId: string) {
        const currentObj = new Types.ObjectId(currentUserId);
        const likerObj = new Types.ObjectId(likerId);

        // Delete the specific like where they liked you
        const result = await LikeModel.deleteMany({
            likerId: likerObj,
            likedId: currentObj,
        });

        console.log(`[declineReceivedLike] user=${currentUserId} declined like from ${likerId}, deleted=${result.deletedCount}`);

        return { ok: true, deleted: result.deletedCount };
    }

}
