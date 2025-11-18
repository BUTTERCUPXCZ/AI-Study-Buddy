import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createNote(@Body() dto: CreateNoteDto) {
    return this.notesService.createNote(
      dto.userId,
      dto.title,
      dto.content,
      dto.source,
    );
  }

  @Get('user/:userId')
  async getUserNotes(@Param('userId') userId: string) {
    return this.notesService.getUserNotes(userId);
  }

  @Get(':noteId/user/:userId')
  async getNoteById(
    @Param('noteId') noteId: string,
    @Param('userId') userId: string,
  ) {
    return this.notesService.getNoteById(noteId, userId);
  }

  @Put(':noteId/user/:userId')
  async updateNote(
    @Param('noteId') noteId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateNoteDto,
  ) {
    return this.notesService.updateNote(noteId, userId, dto.content, dto.title);
  }

  @Delete(':noteId/user/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNote(
    @Param('noteId') noteId: string,
    @Param('userId') userId: string,
  ) {
    await this.notesService.deleteNote(noteId, userId);
  }
}
