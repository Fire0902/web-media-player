import FilesController from '#controllers/files_controller';
import SessionController from '#controllers/session_controller'
import UsersController from '#controllers/users_controller';
import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js';

const session = new SessionController();

router.post('auth', session.store);
router.resource('users', UsersController)
router.resource('files', FilesController).use('*', middleware.auth())
router.get('/stream/:id', [FilesController, 'stream'])

