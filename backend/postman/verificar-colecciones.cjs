/* Ejecutar desde Windows: npm exec --yes --package=newman@6.2.1 -- node postman/verificar-colecciones.cjs
 * Clona SOLO la estructura de DB_NAME. Cada runner usa una base nueva, que se elimina
 * incluso si falla una aserción. Nunca apunta la aplicación al contenido original.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const vm = require('node:vm');
const ts = require('typescript');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { env } = require('../dist/config/env');

function verificarDocumentos() {
  const requests=[];
  let scripts=0;
  for(const file of fs.readdirSync(__dirname).filter(file=>file.endsWith('.json'))) {
    const collection=JSON.parse(fs.readFileSync(path.join(__dirname,file),'utf8'));
    function visitar(item) {
      for(const event of item.event || []) {
        new vm.Script(event.script.exec.join('\n'),{filename:file}); scripts++;
      }
      for(const child of item.item || []) visitar(child);
      if(item.request && file.endsWith('-runner.json')) requests.push(item.request);
    }
    visitar(collection);
  }
  const rutas=[];
  const routeDir=path.join(__dirname,'../src/routes');
  for(const file of fs.readdirSync(routeDir).filter(file=>file.endsWith('.ts'))) {
    const source=ts.createSourceFile(file,fs.readFileSync(path.join(routeDir,file),'utf8'),ts.ScriptTarget.Latest,true);
    function visitar(node) {
      if(ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        ['get','post','put','patch','delete'].includes(node.expression.name.text) &&
        node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
        rutas.push({method:node.expression.name.text.toUpperCase(),url:(file==='authRoutes.ts'?'/auth':'')+node.arguments[0].text});
      }
      ts.forEachChild(node,visitar);
    }
    visitar(source);
  }
  for(const route of rutas) {
    const regex=new RegExp('^'+route.url.split('/').map(segment=>segment.startsWith(':')?'[^/]+':segment.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('/')+'$');
    assert.ok(requests.some(request=>request.method===route.method && regex.test((typeof request.url==='string'?request.url:request.url.raw).replace('{{base_url}}','').split('?')[0])),`Ruta sin casos en los runners: ${route.method} ${route.url}`);
  }
  console.log(JSON.stringify({documentos:'validos',scripts,rutas:rutas.length,requests:requests.length}));
}

function cargarNewman() {
  if(process.argv[2]) return require(path.resolve(process.argv[2]));
  try { return require('newman'); } catch(error) { if(error.code!=='MODULE_NOT_FOUND') throw error; }
  // npm exec agrega su carpeta .bin al PATH; no instala nada en el proyecto.
  for(const bin of (process.env.PATH || '').split(path.delimiter)) {
    const candidate=path.resolve(bin,'../newman/index.js');
    if(path.basename(bin)==='.bin' && fs.existsSync(candidate)) return require(candidate);
  }
  throw Error('Ejecutar mediante npm exec --yes --package=newman@6.2.1 -- node postman/verificar-colecciones.cjs');
}

async function preparar(connection, completo) {
  await connection.query("INSERT INTO sede (id,nombre,direccion,telefono) VALUES (1,'Centro','Calle 1','3424000001'),(2,'Norte','Calle 2','3424000002')");
  await connection.query("INSERT INTO cobertura (id,nombre) VALUES (1,'Cobertura'),(2,'Libre'),(3,'Solo turnos')");
  await connection.query("INSERT INTO especialidad (id,descripcion) VALUES (1,'Clinica'),(2,'Pediatria'),(3,'Solo agenda')");
  const password = await bcrypt.hash('Demo2026!', 10);
  const usuarios = [
    [1,'operador',1,null,'90000007'], [2,'paciente',null,1,'90000010'],
    [3,'medico',1,null,'90000004'], [4,'admin',null,null,'90000001'],
    [5,'medico',2,null,'90000005'], [6,'operador',2,null,'90000008'],
    [7,'paciente',null,1,'90000011'], [8,'medico',1,null,'90000006'],
    [9,'operador',null,null,'90000009'], [10,'operador',1,null,'91000010']
  ];
  if (completo) for (let id=11;id<=32;id++) usuarios.push([id,'paciente',null,1,String(91000000+id)]);
  for (const [id,rol,sede,cobertura,dni] of usuarios) {
    await connection.query('INSERT INTO usuario (id,nombre,apellido,fecha_nacimiento,password,rol,email,telefono,dni,id_sede,id_cobertura) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [id,'Nombre'+id,'Apellido','1990-01-01',password,rol,'u'+id+'@test.local','3424000000',dni,sede,cobertura]);
  }
  await connection.query('INSERT INTO medico_especialidad (id_medico,id_especialidad) VALUES (3,1),(3,2),(5,1),(8,1)');
  const [[fechas]] = await connection.query("SELECT DATE_FORMAT(CURDATE()+INTERVAL 7 DAY,'%Y-%m-%d') AS futuro, DATE_FORMAT(CURDATE()-INTERVAL 7 DAY,'%Y-%m-%d') AS pasado");
  if (completo) {
    for (const [id,medico,sede,especialidad,fecha,entrada,salida] of [
      [1,3,1,1,fechas.futuro,'09:00','11:10'], [2,3,2,1,fechas.futuro,'12:00','13:00'],
      [3,5,2,1,fechas.futuro,'09:00','11:00'], [4,3,1,1,fechas.pasado,'09:00','18:00'],
      [5,3,1,3,fechas.pasado,'18:00','19:00']
    ]) await connection.query('INSERT INTO agenda (id,id_medico,id_sede,id_especialidad,fecha,hora_entrada,hora_salida) VALUES (?,?,?,?,?,?,?)',[id,medico,sede,especialidad,fecha,entrada,salida]);
    const turnos = [[1,1,fechas.futuro,'09:00',2,'confirmado'],[2,2,fechas.futuro,'12:00',7,'confirmado'],
      [3,4,fechas.pasado,'09:00',2,'atendido'],[4,4,fechas.pasado,'09:20',2,'cancelado'],
      [5,4,fechas.pasado,'09:40',2,'atendido'],[6,3,fechas.futuro,'09:00',7,'confirmado'],
      [7,4,fechas.pasado,'10:00',2,'confirmado'],[8,1,fechas.futuro,'09:20',2,'cancelado'],
      [9,4,fechas.pasado,'10:20',7,'atendido'],[10,3,fechas.futuro,'09:20',7,'atendido']];
    for(let id=11;id<=31;id++) {
      const minutos=640+(id-11)*20;
      turnos.push([id,4,fechas.pasado,String(Math.floor(minutos/60)).padStart(2,'0')+':'+String(minutos%60).padStart(2,'0'),2,'cancelado']);
    }
    for(const [id,agenda,fecha,hora,paciente,estado] of turnos) await connection.query('INSERT INTO turno (id,id_agenda,fecha,hora,id_paciente,id_cobertura,estado,nota) VALUES (?,?,?,?,?,?,?,?)',[id,agenda,fecha,hora,paciente,id===4?3:1,estado,'Prueba']);
    for(const [turno,medico,paciente] of [[3,3,2],[9,3,7],[10,5,7]]) await connection.query('INSERT INTO historial_clinico (id_turno,id_medico,id_paciente,diagnostico) VALUES (?,?,?,?)',[turno,medico,paciente,'Diagnostico previo']);
    for(let i=1;i<=15;i++) await connection.query('INSERT INTO notificacion (id,id_usuario,tipo,mensaje,leida) VALUES (?,?,?,?,?)',[i,i<=13?2:i===14?7:3,'prueba','Notificacion '+i,i===13?1:0]);
  }
  return fechas;
}

async function main() {
  verificarDocumentos();
  const newman = cargarNewman();
  const originalDb = env.db.database;
  const control = await mysql.createConnection({ ...env.db });
  const resumen=[];
  try {
    const [tables] = await control.query('SHOW TABLES');
    const ddls=[];
    for(const row of tables) {
      const table=Object.values(row)[0];
      const [[ddl]]=await control.query('SHOW CREATE TABLE '+control.escapeId(originalDb)+'.'+control.escapeId(table));
      ddls.push(ddl['Create Table'].replace(/AUTO_INCREMENT=\d+/g,'AUTO_INCREMENT=1'));
    }
    const disponibles=[1,2,3,4].map(n=>`coleccion-fase-0${n}-runner.json`).concat('coleccion-contrato-actual-runner.json');
    const seleccion=process.argv[3];
    if(seleccion && !disponibles.includes(seleccion)) throw Error('Colección no reconocida.');
    const files=seleccion ? [seleccion] : disponibles;
    for(const [index,file] of files.entries()) {
      const database=`codex_postman_${Date.now()}_${index}`;
      assert.match(database,/^codex_postman_\d+_[0-4]$/);
      assert.notEqual(database,originalDb);
      let created=false,server,pool;
      try {
        await control.query('CREATE DATABASE '+control.escapeId(database)); created=true;
        await control.query('USE '+control.escapeId(database));
        await control.query('SET FOREIGN_KEY_CHECKS=0');
        for(const ddl of ddls) await control.query(ddl);
        await control.query('SET FOREIGN_KEY_CHECKS=1');
        const fechas=await preparar(control,file==='coleccion-contrato-actual-runner.json');
        env.db.database=database;
        // La aplicación y su pool se recargan para cada base aislada.
        for(const key of Object.keys(require.cache)) if(key.startsWith(path.resolve(__dirname,'../dist')+path.sep)&&!key.endsWith(path.join('config','env.js'))) delete require.cache[key];
        pool=require('../dist/config/db').pool;
        const app=require('../dist/app').app;
        server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
        const variables={base_url:`http://127.0.0.1:${server.address().port}`,fixture_fecha:fechas.futuro,fixture_pasado:fechas.pasado,
          expired_token:jwt.sign({id:2,rol:'paciente',id_sede:null},env.jwt.secret,{expiresIn:-1}),
          deleted_token:jwt.sign({id:126,rol:'admin',id_sede:null},env.jwt.secret,{expiresIn:'1h'})};
        const collection=JSON.parse(fs.readFileSync(path.join(__dirname,file),'utf8'));
        const result=await new Promise((resolve,reject)=>newman.run({collection,reporters:[],envVar:Object.entries(variables).map(([key,value])=>({key,value})),timeoutRequest:10000},(error,result)=>error?reject(error):resolve(result)));
        const failures=result.run.failures.map(f=>({request:f.source?.name,error:f.error.message}));
        resumen.push({coleccion:file,requests:result.run.stats.requests.total,aserciones:result.run.stats.assertions.total,fallos:failures});
        console.log(JSON.stringify(resumen.at(-1)));
      } finally {
        if(server) await new Promise(resolve=>server.close(resolve));
        if(pool) await pool.end();
        if(created) {
          await control.query('USE '+control.escapeId(originalDb));
          await control.query('DROP DATABASE '+control.escapeId(database));
        }
        env.db.database=originalDb;
      }
    }
    const report=process.env.POSTMAN_REPORT;
    if(report) fs.writeFileSync(report,JSON.stringify({fecha:new Date().toISOString(),resumen},null,2)+'\n');
    if(resumen.some(r=>r.fallos.length)) process.exitCode=1;
  } finally { await control.end(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
