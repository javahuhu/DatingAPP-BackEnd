import { Router, type Request, type Response } from 'express';
import registerAPI from '../../Application/UseCases/registerUseCases.js';
import UserRepositoryMongo from '../../Data/Repositories/userRepositoryMongo.js';
import passwordHasher from '../../Infrastracture/passwordHasher.js';

const router = Router();
const userRepository = new UserRepositoryMongo();

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }

    const result = await registerAPI(
      { name, email, password },
      { userRepository, passwordHasher }
    );

    return res.status(201).json({
      message: 'User registered',
      user: { id: result.id, email: result.email, name: result.name }
    });
  } catch (err: any) {
    console.error('Register error:', err);
    const status = err.status || 500;
    return res.status(status).json({ message: err.message || 'Internal server error' });
  }
});

export default router;