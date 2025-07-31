/* 
蔡勒公式（德语：Zellers Kongruenz），是一种计算任何一日属一星期中哪一日的算法，由十九世纪德国数学家克里斯提安·蔡勒推算出来。

对于公历，蔡勒公式为
h = (q + [13(m + 1)/5] + K + [K/4] + [J/4] - 2J) mod 7
对于儒略历，蔡勒公式为
h = (q + [13(m + 1)/5] + K + [K/4] + 5 - J) mod 7

h 表示星期几（0 = 星期六，1 = 星期日，2 = 星期一，...，6 = 星期五）
q 代表月份中的日期
m 代表月份（3=三月，4=四月，5=五月，...，14=二月）
K 代表世纪中的年份 ((adjYear) mod 100)
J 是从零开始的世纪数（实际上是 ⌊(adjYear)/100⌋）
[...] 表示取整函数
注意：在此算法中，一月和二月被视为上一年的第 13 和第 14 个月。
对于ISO 周期中的星期几 d (1 ..= 7)
d = ((h + 5) mod 7) + 1

上面公式依赖于数学家对模除法的定义，即−2 mod 7 等于正 5。
遗憾的是，在大多数计算机语言实现取余函数时采用截断方式，−2 mod 7 会返回−2 的结果。
因此，要在计算机上实现泽勒同余，应略微调整公式以确保分子为正。
最简单的办法是将−2J 替换为+5J，将−J 替换为+6J。

对于公历，蔡勒公式变体为：
h = (q + [13(m + 1)/5] + K + [K / 4] + [J / 4] + 5J) mod 7
对于儒略历，蔡勒公式变体为：
h = (q + [13(m + 1)/5] + K + [K / 4] + 5 + 6J) mod 7

在使用计算机时，年份处理为4位数更简单，因此RFC 3339附录B中提及用于公历的情况
对于公历, 变体为:
h + (q + [ 13(m +1) /5] + Y + [Y /4] -[Y/100] + [Y/400] ) mod 7
对于儒略历, 变体为:
h = (q + [13(m + 1)/5] + Y + [Y / 4] + 5) mod 7

*/

/**
 * 计算给定日期的星期几（基于 Michael Keith & Tom Craver 的优化算法）仅公历
 * @param y - 年份（4位数，如 2023）
 * @param m - 月份（1-12）
 * @param d - 日期（1-31）
 * @returns 星期几（0=周日, 1=周一, ..., 6=周六）
 */
export function weekday(y: number, m: number, d: number): number {
  const adjustedY = m < 3 ? y - 1 : y - 2;
  const adjustedD = d + adjustedY;
  return (
    (Math.floor((23 * m) / 9) +
      adjustedD +
      4 +
      Math.floor(y / 4) -
      Math.floor(y / 100) +
      Math.floor(y / 400)) %
    7
  );
}

/**
 * 计算儒略历日期的星期几
 * @param y - 年份（4位数，如 1582）
 * @param m - 月份（1-12）
 * @param d - 日期（1-31）
 * @returns 星期几（0=周六, 1=周日, ..., 6=周五）
 */
export function weekdayJulian(y: number, m: number, d: number): number {
  const adjustedY = m < 3 ? y - 1 : y;
  const adjustedD = d + adjustedY;
  if (m < 3) {
    m += 12;
    y--;
  }
  return (
    (adjustedD +
      Math.floor((13 * (m + 1)) / 5) +
      adjustedY +
      Math.floor(adjustedY / 4) +
      5) %
    7
  );
}
