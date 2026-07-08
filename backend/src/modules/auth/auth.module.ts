import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { AuthGuard } from '../../common/auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/** Global để AuthGuard dùng được ở mọi module mà không cần import lại */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
