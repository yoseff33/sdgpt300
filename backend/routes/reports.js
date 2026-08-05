import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { roleCheck } from '../middleware/roleCheck.js';
import { accountReport, adminReport, invoice, rateSeller } from '../controllers/reportController.js';

const router = Router();
router.use(auth);
router.get('/account', accountReport);
router.get('/admin', roleCheck('admin'), adminReport);
router.get('/invoices/:id', invoice);
router.post('/ratings/:id', rateSeller);
export default router;
