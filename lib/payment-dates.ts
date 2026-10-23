/** A calendar date in Bahia, stored at noon so UTC conversion keeps its day. */
export function parsePaymentDate(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Informe uma data de pagamento válida.')
  const parsed = new Date(`${value}T12:00:00-03:00`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Informe uma data de pagamento válida.')
  return parsed
}

export function bahiaDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value)
}
