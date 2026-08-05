import { Router } from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth.js';
import { roleCheck } from '../middleware/roleCheck.js';
import { list, get, create, update, remove } from '../controllers/productController.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5e6 },
  fileFilter: (_req, file, callback) => callback(null, /^image\//.test(file.mimetype))
});

router.get('/', list);
router.get('/:id', get);
router.post('/', auth, upload.single('image'), create);
router.put('/:id', auth, roleCheck('buyer', 'seller', 'user', 'admin', 'manager'), update);
router.delete('/:id', auth, roleCheck('buyer', 'seller', 'user', 'admin', 'manager'), remove);

export default router;
