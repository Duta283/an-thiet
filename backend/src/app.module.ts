import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { RestaurantsModule } from './modules/restaurants/restaurants.module';
import { ContentModule } from './modules/content/content.module';
import { VerificationModule } from './modules/verification/verification.module';
import { TrustModule } from './modules/trust/trust.module';
import { SocialModule } from './modules/social/social.module';
import { OembedModule } from './modules/oembed/oembed.module';
import { SearchModule } from './modules/search/search.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url:
        process.env.DATABASE_URL ||
        'postgres://anthiet:anthiet_dev@localhost:5432/anthiet',
      autoLoadEntities: true,
      // Schema do db/init.sql quản lý — KHÔNG để TypeORM tự sync
      synchronize: false,
    }),
    AnalyticsModule,
    AuthModule,
    RestaurantsModule,
    ContentModule,
    VerificationModule,
    TrustModule,
    SocialModule,
    OembedModule,
    SearchModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
