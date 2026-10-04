import app from '@adonisjs/core/services/app'
import { FileService } from '#services/file_service'

if (app.getEnvironment() === 'web') {
  const fileService = new FileService()
  // Not awaited: metadata lookups can take minutes on a big library
  // and the API should answer while the scan runs.
  void fileService.sync()
  fileService.startWatcher()
}
