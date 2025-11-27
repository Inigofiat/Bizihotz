"use strict";

const path = require("path");
const mongoose = require("mongoose");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env")
});

const { connectDB } = require("../config/db");
const Cita = require("../data/citaModel");

const weekendCodes = [1, 7];

const run = async () => {
  try {
    await connectDB();
    const count = await Cita.countDocuments({
      $expr: {
        $in: [
          { $dayOfWeek: "$fechaCita" },
          weekendCodes
        ]
      }
    });

    console.log(`Weekend citas count: ${count}`);

    if (count > 0) {
      const muestras = await Cita.find({
        $expr: {
          $in: [
            { $dayOfWeek: "$fechaCita" },
            weekendCodes
          ]
        }
      })
        .sort({ fechaCita: 1 })
        .limit(10)
        .lean();

      console.log("Primeras citas de fin de semana:");
      muestras.forEach((cita, index) => {
        console.log(
          `#${index + 1}`,
          new Date(cita.fechaCita).toISOString(),
          cita.hora,
          cita._id?.toString?.()
        );
      });
    }
  } catch (error) {
    console.error("Error inspeccionando citas de fin de semana:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();
