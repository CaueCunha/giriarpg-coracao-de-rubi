/** Fonte de aleatoriedade com semente, para os testes serem reprodutíveis. */
let s = 123456789;
export function semearDados(seed) {
	s = (Number(seed) >>> 0) || 1;
}
export function aleatorioDado() {
	s ^= s << 13;
	s >>>= 0;
	s ^= s >>> 17;
	s ^= s << 5;
	s >>>= 0;
	return s / 4294967296;
}
