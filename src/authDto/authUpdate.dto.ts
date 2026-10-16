import { AuthCreateDto } from './authCreate.dto';
import { PartialType } from '@nestjs/mapped-types';

export class AuthUpdateDto extends PartialType(AuthCreateDto) {}
