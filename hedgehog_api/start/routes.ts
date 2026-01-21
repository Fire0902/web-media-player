/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import SessionController from '#controllers/session_controller'
import UsersController from '#controllers/users_controller';
import User from '#models/user'
import router from '@adonisjs/core/services/router'

const session = new SessionController();

router.post('auth', session.store);
router.resource('users', UsersController)


