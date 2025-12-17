import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/recovery-password';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) { }

  async validateUser(username: string, password: string): Promise<any> {

    const user = await this.usersService.findByUsername(username);

    if (user) {
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

      if (isPasswordValid && user.activo) {
        const { passwordHash, ...result } = user;
        return result;
      }
    }

    return null;
  }

  async login(user: any) {

    if (!user.activo) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    const payload = {
      username: user.username,
      sub: user.usuarioId,
      email: user.email,
      role: user.role?.nombreRol,
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
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // Verificar si el email ya existe
    const existingUserByEmail = await this.usersService.findByEmail(registerDto.email);
    if (existingUserByEmail) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    // Verificar si el username ya existe
    const existingUserByUsername = await this.usersService.findByUsername(registerDto.username);
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

  async requestPasswordReset(requestPasswordResetDto: RequestPasswordResetDto): Promise<{ message: string }> {
    const { email } = requestPasswordResetDto;

    const user = await this.usersService.findByEmail(email);

    // Por seguridad, no revelamos si el email existe o no
    if (!user) {
      return {
        message: 'Si el email existe en nuestro sistema, recibirás un enlace para resetear tu contraseña'
      };
    }

    // Generar JWT token para recovery
    const resetToken = this.jwtService.sign(
      {
        sub: user.usuarioId,
        email: user.email,
        type: 'password_reset'
      },
      {
        secret: process.env.JWT_SECRET + '_RESET',
        expiresIn: '1h'
      }
    );

    return {
      message: 'Si el email existe en nuestro sistema, recibirás un enlace para resetear tu contraseña'
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { token, password } = resetPasswordDto;

    try {
      // Verificar el JWT token
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET + '_RESET'
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

      // Hash de la nueva contraseña
      const passwordHash = await bcrypt.hash(password, 10);

      // Actualizar contraseña usando el método público
      await this.usersService.updatePassword(userId, password);

      return {
        message: 'Contraseña actualizada exitosamente'
      };

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new BadRequestException('Token expirado');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new BadRequestException('Token inválido');
      }
      throw error;
    }
  }

  // Método temporal para resetear admin
  async resetAdminPassword(): Promise<{ message: string; newPassword?: string }> {
    const admin = await this.usersService.findByUsername('admin');
    if (!admin) {
      throw new NotFoundException('Usuario admin no encontrado');
    }

    const newPassword = 'Admin123!';
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Usar el método público para actualizar
    await this.usersService.updatePassword(admin.usuarioId, newPassword);

    return {
      message: 'Contraseña de admin reseteada exitosamente',
      newPassword: newPassword // Solo para desarrollo
    };
  }
}