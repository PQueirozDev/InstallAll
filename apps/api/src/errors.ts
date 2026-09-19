export class AppError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}
export const publicMessage = (error: unknown) => error instanceof AppError ? error.message : "Não foi possível concluir o processamento.";
