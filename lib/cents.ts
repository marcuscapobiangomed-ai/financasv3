/**
 * Divide um valor total em parcelas exatas em centavos para evitar erros de ponto flutuante.
 * Distribui os centavos de resto nas primeiras parcelas.
 * 
 * Ex: divideCents(100.00, 3) -> [33.34, 33.33, 33.33]
 */
export function divideCents(totalAmount: number, installmentsCount: number): number[] {
  if (installmentsCount <= 0) return [];
  
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / installmentsCount);
  const remainderCents = totalCents % installmentsCount;

  return Array.from({ length: installmentsCount }, (_, i) => {
    const extra = i < remainderCents ? 1 : 0;
    return (baseCents + extra) / 100;
  });
}
