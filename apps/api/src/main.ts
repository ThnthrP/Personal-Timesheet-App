import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // ตัด field ที่ไม่ได้ประกาศไว้ใน DTO ทิ้งอัตโนมัติ
      forbidNonWhitelisted: true, // ถ้าส่ง field แปลกปลอมมา ให้ error ทันที
      transform: true, // แปลง plain object เป็น class instance (จำเป็นสำหรับ nested array validation)
    }),
  );

  app.enableCors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT || 4101;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}
bootstrap();