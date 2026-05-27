import Episode from '#models/episode'
import User from '#models/user'
import { FileService } from '#services/file_service'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import path from 'path'
import fs from 'fs'
import { Secret } from '@adonisjs/core/helpers'

@inject()
export default class FilesController {
  constructor(private fileService: FileService) { }

  async index({ response }: HttpContext) {
    const medias = await this.fileService.index()
    return response.status(200).json(medias)
  }

  async stream({ request, response, params }: HttpContext) {
    const token = request.qs().token as string | undefined
    if (!token) return response.unauthorized('Missing token')

    const user = await User.accessTokens.verify(new Secret(token))
    if (!user) return response.unauthorized('Invalid token')

    const episode = await Episode.findOrFail(params.id)
    const safePath = path.resolve(episode.path.replace(/\//g, path.sep))
    const mediaRoot = path.resolve('./media')

    console.log('episode.path:', episode.path)
    console.log('safePath:', safePath)
    console.log('mediaRoot:', mediaRoot)
    console.log('starts with:', safePath.startsWith(mediaRoot))

    if (!safePath.startsWith(mediaRoot)) return response.forbidden()

    const stat = fs.statSync(safePath)
    const fileSize = stat.size
    const range = request.header('range')

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = end - start + 1

      response.status(206)
      response.header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
      response.header('Accept-Ranges', 'bytes')
      response.header('Content-Length', String(chunkSize))
      response.header('Content-Type', 'video/mp4')

      return response.stream(fs.createReadStream(safePath, { start, end }))
    }

    response.header('Content-Length', String(fileSize))
    response.header('Accept-Ranges', 'bytes')
    response.header('Content-Type', 'video/mp4')
    return response.stream(fs.createReadStream(safePath))
  }

  async create({ }: HttpContext) { }
  async store({ }: HttpContext) { }
  async show({ }: HttpContext) { }
  async edit({ }: HttpContext) { }
  async update({ }: HttpContext) { }
  async destroy({ }: HttpContext) { }
}