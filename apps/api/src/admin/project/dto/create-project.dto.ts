import { IsString, IsNotEmpty } from 'class-validator';

export class CreateProjectDto {
    @IsString()
    @IsNotEmpty()
    code: string;

    @IsString()
    @IsNotEmpty()
    name: string;
}