const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 3000;

app.get('/', (req, res) => {
  res.redirect('/menu.html');
});


// Para servir archivos estáticos desde la carpeta 'public'
app.use(express.static('public'));


// Conectar a la base de datos
let db = new sqlite3.Database('./turnos.db', sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Conectado a la base de datos.');
});

// Middleware para parsear JSON
app.use(express.json());

// Obtener todos los turnos
app.get('/api/turnos', (req, res) => {
  const sql = "SELECT * FROM turnos";
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Actualizar el estado de un turno
app.put('/api/turnos/:id', (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  
  const sql = `UPDATE turnos SET estado = ? WHERE id = ?`;
  db.run(sql, [estado, id], function(err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({ message: "Estado actualizado", changes: this.changes });
  });
});

app.post('/api/clientes', (req, res) => {
  const { nombre, telefono, email, turnoId } = req.body;

  // Verificar si el turno existe
  const checkTurnoSql = `SELECT * FROM turnos WHERE id = ?`;
  db.get(checkTurnoSql, [turnoId], (err, row) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!row) {
      // El turno no existe, crearlo
      const insertTurnoSql = `INSERT INTO turnos (id, estado) VALUES (?, 'libre')`;
      db.run(insertTurnoSql, [turnoId], function(err) {
        if (err) {
          return res.status(400).json({ error: err.message });
        }
      });
    }

    // Insertar el cliente (asumiendo que el turno ahora existe)
    const insertClienteSql = `INSERT INTO clientes (nombre, telefono, email) VALUES (?, ?, ?)`;
    db.run(insertClienteSql, [nombre, telefono, email], function(err) {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      const clienteId = this.lastID;
      const updateTurnoSql = `UPDATE turnos SET cliente_id = ? WHERE id = ?`;
      db.run(updateTurnoSql, [clienteId, turnoId], function(err) {
        if (err) {
          return res.status(400).json({ error: err.message });
        }
        res.json({ message: "Cliente insertado y turno actualizado", clienteId: clienteId });
      });
    });
  });
});



// Obtener la información del cliente basada en el id del turno
app.get('/api/clientes/:turnoId', (req, res) => {
  const { turnoId } = req.params;
  const sql = `SELECT c.* FROM clientes c INNER JOIN turnos t ON c.id = t.cliente_id WHERE t.id = ?`;
  db.get(sql, [turnoId], (err, row) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (row) {
      res.json(row);
    } else {
      res.json(null);
    }
  });
  
});

// Eliminar un cliente basado en el id del turno
app.delete('/api/clientes/:turnoId', (req, res) => {
  const { turnoId } = req.params;
  const sql = `DELETE FROM clientes WHERE id = (SELECT cliente_id FROM turnos WHERE id = ?)`;
  db.run(sql, [turnoId], function(err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    res.json({ message: "Cliente eliminado", changes: this.changes });
  });
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});

const cron = require('node-cron');

// Tarea de cron que se ejecuta todos los días a las 23:55
cron.schedule('55 23 * * *', () => {
    // Obtener el día actual
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const today = new Date();
    const currentDay = days[today.getDay()];

    // Actualizar el estado de los turnos del día actual a 'libre'
    const sql = `UPDATE turnos SET estado = 'libre' WHERE dia = ?`;
    db.run(sql, [currentDay], function(err) {
        if (err) {
            return console.error(err.message);
        }
        console.log(`Se han actualizado los turnos del día ${currentDay} a 'libre'.`);
    });
});
