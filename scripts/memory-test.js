// scripts/memory-test.ts
import { MemoryHelper } from '../src/utils/memory-helper';

async function memoryTest() {
  console.log('📊 ESTADO INICIAL DE MEMORIA:');
  console.log(MemoryHelper.getMemoryUsage());

  // Simular carga
  const largeArray = [];
  for (let i = 0; i < 10000; i++) {
    largeArray.push({ id: i, data: 'x'.repeat(1000) });
  }

  console.log('\n📊 DESPUÉS DE CARGA:');
  console.log(MemoryHelper.getMemoryUsage());
  console.log('Tamaño estimado:', MemoryHelper.estimateObjectSize(largeArray) / 1024 / 1024, 'MB');

  // Liberar
  largeArray.length = 0;
  await MemoryHelper.forceRelease();

  console.log('\n📊 DESPUÉS DE GC:');
  console.log(MemoryHelper.getMemoryUsage());
}

memoryTest();