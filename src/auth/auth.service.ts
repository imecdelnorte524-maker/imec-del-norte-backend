// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/recovery-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    public jwtService: JwtService,
    private readonly mailService: MailService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.usersService.findByUsername(username);

    if (user && user.passwordHash) {
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      if (isPasswordValid && user.activo) {
        const { passwordHash, ...result } = user;
        return result;
      }
    }

    return null;
  }

  // src/auth/auth.service.ts (solo el método login, el resto igual)
  async login(user: any) {
    if (!user.activo) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    const payload = {
      username: user.username,
      sub: user.usuarioId,
      email: user.email,
      role: user.role?.nombreRol,
      // opcional: también en el payload
      mustChangePassword: user.mustChangePassword,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        userId: user.usuarioId,
        email: user.email,
        username: user.username,
        nombre: user.nombre,
        apellido: user.apellido,
        role: user.role?.nombreRol,
        telefono: user.telefono,
        mustChangePassword: user.mustChangePassword, // ← NUEVO
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // Verificar si el email ya existe
    const existingUserByEmail = await this.usersService.findByEmail(
      registerDto.email,
    );
    if (existingUserByEmail) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    // Verificar si el username ya existe
    const existingUserByUsername = await this.usersService.findByUsername(
      registerDto.username,
    );
    if (existingUserByUsername) {
      throw new ConflictException('El nombre de usuario ya está registrado');
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    // Crear usuario usando el método createWithPasswordHash
    const user = await this.usersService.createWithPasswordHash({
      ...registerDto,
      passwordHash,
    });

    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      message: 'Usuario registrado exitosamente',
      user: userWithoutPassword,
    };
  }

  async getProfile(userId: number) {
    const user = await this.usersService.findOne(userId);

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Solicitar reseteo de contraseña
   * - Genera un JWT con type=password_reset
   * - Envía correo con enlace al FRONTEND (/reset-password?token=...)
   * - En desarrollo puede devolver resetToken y resetUrl para debug
   */
  async requestPasswordReset(
    requestPasswordResetDto: RequestPasswordResetDto,
  ): Promise<{ message: string; resetToken?: string; resetUrl?: string }> {
    const { email } = requestPasswordResetDto;

    const user = await this.usersService.findByEmail(email);

    // Por seguridad, misma respuesta exista o no el usuario
    if (!user) {
      return {
        message:
          'Si el email existe en nuestro sistema, recibirás un enlace para resetear tu contraseña',
      };
    }

    // Generar JWT token para recovery
    const resetToken = this.jwtService.sign(
      {
        sub: user.usuarioId,
        email: user.email,
        type: 'password_reset',
      },
      {
        secret: process.env.JWT_SECRET + '_RESET',
        expiresIn: '1h',
      },
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3032';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Enviar correo usando MailService
    try {
      await this.mailService.sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        nameuser: user.nombre,
      });
    } catch (err) {
      // No exponemos el error al cliente por seguridad, solo log
      console.error('❌ Error enviando correo de recuperación:', err);
    }

    // En desarrollo puede ser útil devolver token/url
    const isDev =
      !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

    return {
      message:
        'Si el email existe en nuestro sistema, recibirás un enlace para resetear tu contraseña',
      ...(isDev ? { resetToken, resetUrl } : {}),
    };
  }

  async resetPassword(
    resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const { token, password } = resetPasswordDto;

    try {
      // Verificar el JWT token
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET + '_RESET',
      });

      // Verificar que es un token de password reset
      if (payload.type !== 'password_reset') {
        throw new BadRequestException('Token inválido');
      }

      const userId = payload.sub;

      // Buscar usuario
      const user = await this.usersService.findOne(userId);
      if (!user) {
        throw new BadRequestException('Usuario no encontrado');
      }

      // Aquí se aplica también historial de contraseñas
      await this.usersService.updatePassword(userId, password);

      return {
        message: 'Contraseña actualizada exitosamente',
      };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new BadRequestException('Token expirado');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new BadRequestException('Token inválido');
      }
      throw error;
    }
  }

  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const { currentPassword, newPassword } = dto;

    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Validar contraseña actual
    if (!user.passwordHash) {
      throw new BadRequestException('Usuario no tiene contraseña configurada');
    }

    const isCurrentValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!isCurrentValid) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }

    // Validación de complejidad ya se hace en el DTO (class-validator)
    // Aquí delegamos actualización + historial a UsersService
    await this.usersService.updatePassword(userId, newPassword);

    return {
      message: 'Contraseña actualizada exitosamente',
    };
  }

  async resetAdminPassword(): Promise<{
    message: string;
    newPassword?: string;
  }> {
    const admin = await this.usersService.findByUsername('admin');
    if (!admin) {
      throw new NotFoundException('Usuario admin no encontrado');
    }

    const newPassword = 'Admin123!';
    await this.usersService.updatePassword(admin.usuarioId, newPassword);

    return {
      message: 'Contraseña de admin reseteada exitosamente',
      newPassword,
    };
  }
}
