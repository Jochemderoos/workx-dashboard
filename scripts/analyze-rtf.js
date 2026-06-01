const fs = require("fs");
const content = fs.readFileSync("C:\\Users\\quiri\\Downloads\\Urenoverzicht per medewerker per dag-01032026_0948.rtf", "utf-8");

const dateRegex = /(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag),\s*(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)\s+(\d{4})/gi;
const dates = new Set();
let m;
while ((m = dateRegex.exec(content)) !== null) {
  dates.add(m[2] + " " + m[3] + " " + m[4]);
}
const sorted = [...dates].sort();
console.log("Unieke datums:", sorted.length);
if (sorted.length > 0) {
  console.log("Eerste:", sorted[0]);
  console.log("Laatste:", sorted[sorted.length - 1]);
}

const names = ["Hanna", "Justine", "Marlieke", "Wies", "Emma", "Alain", "Kay", "Erika", "Heleen", "Barbara", "Lotte", "Julia", "Lodewijk", "Marnix", "Jochem", "Maaike", "Bas", "Juliette"];
for (const name of names) {
  const count = (content.match(new RegExp(name, "g")) || []).length;
  if (count > 0) console.log(name + ":", count, "keer");
}
