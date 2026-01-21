import { UserService } from '#services/user_service';
import { inject } from '@adonisjs/core';
import type { HttpContext } from '@adonisjs/core/http'


@inject()
export default class UsersController {
  constructor(
    private userService: UserService
  ) {}

  /**
   * Display a list of resource
   */
  async index({}: HttpContext) {
    return this.userService.index();
  }

  /**
   * Display form to create a new record
   */
  async create({}: HttpContext) {}

  /**
   * Handle form submission for the create action
   */
  async store({ request, response }: HttpContext) {
    const data = request.only(['email', 'pseudo', 'password']);
    this.userService.store(data);
    return response.status(201)
  }

  /**
   * Show individual record
   */
  async show({ params }: HttpContext) {}

  /**
   * Edit individual record
   */
  async edit({ params }: HttpContext) {}

  /**
   * Handle form submission for the edit action
   */
  async update({ params, request }: HttpContext) {}

  /**
   * Delete record
   */
  async destroy({ params }: HttpContext) {}
}