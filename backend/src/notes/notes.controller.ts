import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { NotesService } from './notes.service';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';
import { Note } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('notes')
@UseGuards(AuthGuard, EmailVerifiedGuard)
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createNote(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateNoteDto,
  ): Promise<Note> {
    return this.notesService.createNote(
      userId,
      dto.title,
      dto.content,
      dto.source,
    );
  }

  @Get()
  async getUserNotes(
    @CurrentUser('id') userId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<unknown> {
    // Backwards compatible: if neither pagination param is set, return the
    // legacy "all notes" shape that existing clients expect. Once any
    // client opts into pagination by sending `?limit=…`, return the
    // { items, nextCursor } envelope.
    if (!cursor && !limit) {
      return this.notesService.getUserNotes(userId);
    }
    const parsedLimit = limit ? Number(limit) : 20;
    return this.notesService.getUserNotesPaginated(userId, {
      cursor,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : 20,
    });
  }

  @Get(':noteId')
  async getNoteById(
    @CurrentUser('id') userId: string,
    @Param('noteId') noteId: string,
  ): Promise<unknown> {
    return this.notesService.getNoteById(noteId, userId);
  }

  @Put(':noteId')
  async updateNote(
    @CurrentUser('id') userId: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdateNoteDto,
  ): Promise<unknown> {
    return this.notesService.updateNote(noteId, userId, dto.content, dto.title);
  }

  @Delete(':noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteNote(
    @CurrentUser('id') userId: string,
    @Param('noteId') noteId: string,
  ) {
    await this.notesService.deleteNote(noteId, userId);
  }
}
