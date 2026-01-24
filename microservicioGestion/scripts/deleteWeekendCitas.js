"use strict";

const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env")
});

const { connectDB } = require("../src/config/db");
const Cita = require("../src/models/citaModel");

const weekendCodes = [1, 7]; // Mongo $dayOfWeek: 1 = domingo, 7 = sabado
const TIMEZONE = process.env.BIZIHOTZ_TZ || process.env.TZ || "Europe/Madrid";

const removeWeekendAppointments = async () => {
  try {
    await connectDB();

    const { deletedCount } = await Cita.deleteMany({
      $expr: {
        $in: [
          {
            $dayOfWeek: {
              date: "$fechaCita",
              timezone: TIMEZONE
            }
          },
          weekendCodes
        ]
      }
    });

    console.log(`Citas eliminadas (fin de semana): ${deletedCount}`);
  } catch (error) {
    console.error("Error eliminando citas de fin de semana:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

removeWeekendAppointments();
