/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp(functions.config().firebase);

// Function to calculate time difference in coefficients (seconds) between two timestamps
function calculateTimeDifference(timestamp1, timestamp2) {
  const time1 = timestamp1.toMillis();
  const time2 = timestamp2.toMillis();
  const difference = Math.abs((time1 - time2) / time2) * 10000; // Converting milliseconds to coefficients
  return Math.max(2, parseInt(difference)); // Ensure minimum value of 2
}

// Function to calculate and append time difference for each event
function calculateAndAppendTimeDifference(events) {
  return events.map((event, index) => {
    if (index === 0) {
      event.line_height = 2; // First object has no previous timestamp
    } else {
      const previousTime = events[index - 1].created_at;
      const currentTime = event.created_at;
      event.line_height = calculateTimeDifference(currentTime, previousTime);
    }
    return event;
  });
}

exports.diffCalcFB = functions.https.onRequest((req, res) => {
  const db = admin.firestore();
  const user = req.body.userId;

  db.collection("event_records").where("user", "==", user).orderBy("created_at", "asc").get()
      .then((snapshot) => {
        const events = [];
        snapshot.forEach((doc) => {
          const event = {
            id: doc.id,
            title: doc.data().title,
            created_at: doc.data().created_at,
            line_height: doc.data().line_height || 0, // Default value for line_height
          };
          events.push(event);
        });

        const eventsWithLineHeight = calculateAndAppendTimeDifference(events);

        const batch = db.batch();
        eventsWithLineHeight.forEach((event) => {
          const docRef = db.collection("event_records").doc(event.id);
          batch.update(docRef, {line_height: event.line_height});
        });

        return batch.commit();
      })
      .then(() => {
        res.status(200).send("Success");
        console.log("Batch update successful!");
      })
      .catch((error) => {
        console.error("Error updating documents: ", error);
        res.status(500).send("Error updating documents");
      });
});
