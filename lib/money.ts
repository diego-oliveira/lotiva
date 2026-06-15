import { Prisma } from '@/app/generated/prisma'

export type MoneyInput = Prisma.Decimal | number | string

export function decimal(value: MoneyInput) {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

export function moneyToNumber(value: MoneyInput) {
  return decimal(value).toNumber()
}

export function addMoney(...values: MoneyInput[]) {
  return values.reduce<Prisma.Decimal>(
    (total, value) => total.plus(value),
    new Prisma.Decimal(0),
  ).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

export function subtractMoney(left: MoneyInput, right: MoneyInput) {
  return decimal(left).minus(right).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}

export function multiplyMoney(value: MoneyInput, multiplier: number) {
  return decimal(value).times(multiplier).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
}
