import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { SequenceCheckerService } from '../src/database/sequence-checker';

async function bootstrap() {
  console.log('\n🔧 CORRECTOR DE SECUENCIAS\n');
  
  const app = await NestFactory.createApplicationContext(AppModule);
  const checker = app.get(SequenceCheckerService);
  
  try {
    const reports = await checker.checkAllSequences();
    const problemas = reports.filter(r => r.status === 'DESINCRONIZADA');
    
    if (problemas.length === 0) {
      console.log('✅ ¡Todo está correcto! No hay secuencias desincronizadas.\n');
      await app.close();
      process.exit(0);
    }
    
    console.log(`⚠️  Se encontraron ${problemas.length} problemas:\n`);
    
    problemas.forEach((rep, i) => {
      console.log(`${i + 1}. ${rep.tableName}.${rep.columnName}`);
      console.log(`   Secuencia: ${rep.sequenceName}`);
      console.log(`   Máx ID: ${rep.maxId} | Último valor: ${rep.lastValue}`);
      console.log(`   Nuevo valor: ${rep.maxId + 1}\n`);
    });
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    rl.question('¿Corregir estas secuencias? (s/n): ', async (respuesta) => {
      if (respuesta.toLowerCase() === 's') {
        console.log('\n🔧 Corrigiendo...\n');
        
        const result = await checker.fixAllDesincronizadas();
        
        console.log(`✅ Resultado: ${result.fixed} de ${result.total} corregidas\n`);
        
        console.log('📊 Estado final:');
        await checker.showReport();
        
      } else {
        console.log('\n❌ Cancelado\n');
      }
      
      rl.close();
      await app.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    await app.close();
    process.exit(1);
  }
}

bootstrap();