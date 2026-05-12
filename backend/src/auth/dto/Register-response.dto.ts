// Response contract for POST /auth/register. Kept distinct from any login or
// OAuth response so a downstream change (e.g. someone wires Supabase email-
// confirm OFF) can't quietly attach a session payload here and skip the
// /emailVerify flow. The frontend `useRegister` mutation enforces the same
// shape on its end — both sides reject any drift loudly.
export class RegisterResponseDto {
  message!: string;
  user!: {
    id: string;
    email: string;
    emailVerified: boolean;
  };
}
