import User from "#models/user";

export class UserService {
  async index(){
    return await User.all();
  }
  async store(data: Record<string, any>){
    return await User.create(data);
  }
}