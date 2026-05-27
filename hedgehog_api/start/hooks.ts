import app from '@adonisjs/core/services/app'
import { FileService } from '#services/file_service'


if (app.getEnvironment() === 'web') {
  const fileService = new FileService()
  await fileService.sync()
  fileService.startWatcher()
}