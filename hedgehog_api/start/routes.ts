import AdminController from '#controllers/admin_controller'
import FilesController from '#controllers/files_controller'
import ProgressController from '#controllers/progress_controller'
import SessionController from '#controllers/session_controller'
import SetupController from '#controllers/setup_controller'
import SubtitlesController from '#controllers/subtitles_controller'
import UsersController from '#controllers/users_controller'
import router from '@adonisjs/core/services/router'
import { middleware } from './kernel.js'

router.get('setup', [SetupController, 'status'])
router.post('setup', [SetupController, 'create'])

router.post('auth', [SessionController, 'store'])

// Token-in-query auth so <video src>, <track src> and JASSUB's subUrl
// work directly.
router.get('/stream/:id', [FilesController, 'stream'])
router.get('/episodes/:id/subtitles/:trackId', [SubtitlesController, 'show'])

router
  .group(() => {
    router.delete('auth', [SessionController, 'destroy'])
    router.get('me', [SessionController, 'show'])
    router.put('me', [SessionController, 'update'])

    router.get('files', [FilesController, 'index'])
    router.get('/episodes/:id/media', [FilesController, 'media'])
    router.get('/episodes/:id/keyframe', [FilesController, 'keyframe'])
    router.get('/episodes/:id/subtitles', [SubtitlesController, 'index'])

    router.get('progress', [ProgressController, 'index'])
    router.delete('progress/session', [ProgressController, 'stop'])
    router.put('/episodes/:id/progress', [ProgressController, 'update'])
    router.put('/episodes/:id/watched', [ProgressController, 'watchedEpisode'])
    router.put('/seasons/:id/watched', [ProgressController, 'watchedSeason'])
    router.put('/animes/:id/watched', [ProgressController, 'watchedAnime'])

    router.get('favorites', [ProgressController, 'favorites'])
    router.put('/animes/:id/favorite', [ProgressController, 'favorite'])

    router
      .group(() => {
        router.get('users', [UsersController, 'index'])
        router.post('users', [UsersController, 'store'])
        router.put('users/:id', [UsersController, 'update'])
        router.delete('users/:id', [UsersController, 'destroy'])

        router.get('admin/dashboard', [AdminController, 'dashboard'])
        router.post('library/scan', [AdminController, 'scan'])
        router.post('/animes/:id/metadata', [AdminController, 'refreshMetadata'])
      })
      .use(middleware.admin())
  })
  .use(middleware.auth())
