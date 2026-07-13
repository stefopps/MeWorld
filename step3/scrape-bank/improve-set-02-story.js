// Rewrite Set 2 (Chest pain) story with standalone avatar + spine-anchored narrative.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'set-02-story-va.html'), 'utf8');

const newStory = {
  "1": [
    {
      "stage": "You",
      "text": "Amara is twenty minutes into her morning lecture when the pain lands. Not the familiar ache of a long night studying. This is sharp, pleuritic, and it takes her breath by surprise. She puts her hand flat against her sternum. The lecturer's voice fades into a hum. Ten minutes later she is in the emergency department, pulse 112, oxygen saturation 91 percent on room air, still trying to describe the pain to the triage nurse while short sentences come out in pieces. [[1]]"
    },
    {
      "stage": "Need",
      "text": "Dr. Reyes sees the chart before she sees the patient: 32 year old woman, known SLE, sudden pleuritic chest pain, tachycardia, hypoxia. She does not say the words out loud but the fork is already forming in her mind. ACS versus PE versus dissection. Amara is young, but she has lupus. Lupus means hypercoagulable. Lupus means premature vascular risk. The cheapest discriminator is the one that rules out the thing most likely to kill her fastest. [[2]]"
    },
    {
      "stage": "Go",
      "text": "The threshold is a CT pulmonary angiogram ordered before troponins even return. Amara lies on the scanner table while the contrast floods her veins and Dr. Reyes watches the images resolve in real time. Someone else walked this same doorway last month, a 58 year old woman, postmenopausal, hypertensive, sudden tearing chest pain radiating to the back. Same chief complaint, same bay, same urgency. Different clock. That patient went to the CT scanner for dissection, not embolism. [[3]]"
    },
    {
      "stage": "Search",
      "text": "The wrong turn would be easy here. Amara has known SLE. SLE causes accelerated atherosclerosis. A 68 year old woman with diabetes and hyperlipidemia came through this same ED two days ago with post PCI chest pain. Same presentation, same troponin leak, same EKG changes. Dr. Reyes knows the trap: assume coronary because the risk factors line up. But the Wells score is sitting at six, and the EKG shows sinus tachycardia without ST changes. [[4]]"
    },
    {
      "stage": "Find",
      "text": "The CTPA loads and the clot is unmistakable. A saddle embolus, bilateral, sitting across the pulmonary artery bifurcation. No dissection flap. No coronary thrombus. The mechanism is not atherosclerosis, not plaque rupture. It is hypercoagulability, the quiet consequence of antiphospholipid antibodies that Amara has been carrying since her lupus diagnosis three years ago. The finding is not mood. It is a clot where it should not be, in a vessel too young for the burden it is carrying. [[5]]"
    },
    {
      "stage": "Take",
      "text": "Somewhere else the cost already landed. A 72 year old woman with AML, on low molecular weight heparin, walked into an ED six months ago with chest pain and the same CT finding. Same saddle embolus, same hypoxia, same Wells score. But her platelets were fifty thousand and the anticoagulation that would have saved her was the thing that could not be given. Dr. Reyes brings that cost into the room without theatrics. Amara is young. Her platelets are normal. The window is open. [[6]]"
    },
    {
      "stage": "Return",
      "text": "Back to Amara with the near miss in hand. The case that almost fits but does not: a 62 year old postmenopausal woman, sudden onset chest pain, same bay, same EKG, same initial read of 'rule out ACS.' But her CT showed no clot, no flap. Her pain was esophageal spasm after a large meal. Dr. Reyes brings this comparison case to the bedside not to dismiss Amara's pain but to sharpen what hers actually is. Hypercoagulable. Pro thrombotic. A clot where the story says one should not be. [[7]]"
    },
    {
      "stage": "Change",
      "text": "By the end of the visit Amara has a name for what happened and a next step. She will start anticoagulation. She will have a thrombophilia workup. The reference case that sticks is the 42 year old man with recurrent postprandial chest pain whose antacids worked. Not because his pain was trivial, but because his pain was not hers. The difference is the lesson. The lesson is the thing she will hear again six months from now when her lupus surfaces in a different cavity, with different pain, and a different fork. [[8]]"
    }
  ],
  "2": [
    {
      "stage": "You",
      "text": "Amara is in the stepdown unit, heparin running, nasal cannula at two liters, when the code blue alarm rings from the bay she was in three hours ago. She does not flinch. She listens. The voice over the intercom is calm. The alarm stops before the response team even arrives. [[1]]"
    },
    {
      "stage": "Need",
      "text": "Dr. Reyes comes by during rounds with a teaching moment Amara did not ask for but is ready to receive. The patient in the bay, the one who nearly coded, is a 45 year old man. Recent orthopedic surgery. Sudden shortness of breath. Hypoxia without a clean coronary story. Same fork Amara walked through. Same CT scanner. Different reason the clot formed: stasis, not antibodies. [[2]]"
    },
    {
      "stage": "Go",
      "text": "She walks Amara through the rest of the bay mentally. A 28 year old woman, acute onset shortness of breath, pleuritic chest pain, no prior medical history. Her PE came from oral contraceptives. A 42 year old woman, DVT, OCP use. Same clot. Same fork. Same CT finding. Different road to it. [[3]]"
    },
    {
      "stage": "Search",
      "text": "Amara watches from her bed as the 45 year old post orthopedic surgery patient is wheeled past her door to the CT scanner. She recognizes the look on his face. The same look she had two hours ago when the pain was at its peak and no one had told her yet what it was. Dr. Reyes sees her watching and says nothing. [[4]]"
    },
    {
      "stage": "Find",
      "text": "The 28 year old woman's CTPA comes back positive. Saddle embolus. Same as Amara's. The difference is not in the imaging. It is in the mechanism: estrogen driven hypercoagulability versus antibody driven. Antiphospholipid versus OCP. The finding is the same. The next step is different. [[5]]"
    },
    {
      "stage": "Take",
      "text": "Dr. Reyes points to the window. A 60 year old man downstairs, type 2 diabetes, hypertension, admitted for DVT, now with acute shortness of breath. His PE is the predictable consequence of a clot that traveled. Amara's PE was the first sign. The difference is not academic. It changes the duration of anticoagulation. [[6]]"
    },
    {
      "stage": "Return",
      "text": "The return case that sharpens Amara's own is the 54 year old man with DVT history whose CT showed not PE but pericarditis. Same symptoms. Same EKG. Different finding entirely. Dr. Reyes uses this comparison to make the point without overstating it: imaging is the only honest witness in a chest pain bay. [[7]]"
    },
    {
      "stage": "Change",
      "text": "By discharge Amara knows three things she did not know when she walked in. First, her APS panel will come back positive, and that will change her lifelong management. Second, the same clot can form in a dozen different bodies for a dozen different reasons. Third, the fork that saved her life this time is the same fork she will need to recognize if the pain ever comes back in a different shape. [[8]]"
    }
  ],
  "3": [
    {
      "stage": "You",
      "text": "Amara is back in clinic four weeks after discharge. INR stable. No new symptoms. Dr. Reyes has a teaching tablet open on the desk beside the exam table, angled so Amara can see it. [[1]]"
    },
    {
      "stage": "Need",
      "text": "She pulls up a CT from last week. A 58 year old woman, poorly controlled hypertension, sudden tearing chest pain radiating to the back. The image shows an intimal flap in the ascending aorta. This is the fork that Amara's Wells score correctly ruled out. Dr. Reyes wants her to understand what was excluded and why. [[2]]"
    },
    {
      "stage": "Go",
      "text": "The lesson is not abstract. She flips to a second scan. A 42 year old man with Marfan syndrome, same presentation, same tearing pain, same dissection. Different body, same aortic catastrophe. The connective tissue is the through line. Amara's lupus is a connective tissue disease. The connection is not direct but it is real. [[3]]"
    },
    {
      "stage": "Search",
      "text": "Dr. Reyes scrolls to a comparison case from the same week: a 52 year old woman with hypertension and smoking, chest pain three days after a stressful family event. Troponin elevated. Cath showed three vessel disease. The fork branched differently for her: ACS, not dissection. Same chief complaint. Different anatomy. Different clock. [[4]]"
    },
    {
      "stage": "Find",
      "text": "The finding that separates the dissection from the ACS is not subtle but it is easy to miss under pressure. Pulse deficit in the left arm. Widened mediastinum on portable chest X-ray. The 58 year old had both. The 52 year old had neither. Dr. Reyes walks Amara through the physical exam findings on the tablet as if she is pre rounding with a junior resident. [[5]]"
    },
    {
      "stage": "Take",
      "text": "The 42 year old Marfan patient survived surgery but required a mechanical aortic valve. The cost was a lifetime of warfarin. Amara is already on warfarin for her PE. The overlap is not lost on her. Dr. Reyes does not make the connection out loud but she does not need to. Amara is tracking. [[6]]"
    },
    {
      "stage": "Return",
      "text": "The return that clarifies everything is the case of a 56 year old man with sudden tearing chest pain and syncope. His CT showed Type A dissection extending into the coronary ostia. He did not make it to the OR. Dr. Reyes closes the image without commentary. Amara understands: the fast fork saves lives when it is taken fast. [[7]]"
    },
    {
      "stage": "Change",
      "text": "Amara leaves clinic with a new piece of diagnostic reasoning she did not have when she walked into the ED a month ago. Chest pain is not one question. It is three questions asked in parallel: coronary, pulmonary, aortic. The fastest answer is the one you rule out first. She walks out knowing the order. [[8]]"
    }
  ],
  "4": [
    {
      "stage": "You",
      "text": "Six months pass. Amara is in the middle of an afternoon coffee with a friend when the pain returns. This time it is different. Positional. Better when she leans forward. Worse when she lies flat. She knows enough now to recognize that this is not the same pain as the PE. But she also knows enough to go straight to the ED without waiting for it to resolve. [[1]]"
    },
    {
      "stage": "Need",
      "text": "Dr. Reyes meets her in the same bay. Same bed, near enough. The EKG is up before the blood draw is done. Diffuse ST elevation. PR depression. The pattern is unmistakable. This is pericarditis. Not a recurrent PE. Not an MI. Her lupus has surfaced in a new cavity, and the inflammation is pressing against the sac around her heart. [[2]]"
    },
    {
      "stage": "Go",
      "text": "The threshold crossed this time is not between life and death. It is between one organ system and another. Amara's SLE announced itself three years ago with joint pain and a malar rash. Six months ago it declared itself again with a saddle PE from antiphospholipid antibodies. Now it has moved into the pericardium. Dr. Reyes orders an echocardiogram and an NSAID, and the lesson begins. [[3]]"
    },
    {
      "stage": "Search",
      "text": "The wrong turn would be to chase the troponin. It is mildly elevated. The EKG shows ST elevation. A 47 year old woman sat in this same bay last month with the same EKG and the same troponin leak. Her cath showed clean coronaries. Her final diagnosis was also pericarditis, but hers was viral, not autoimmune. [[4]]"
    },
    {
      "stage": "Find",
      "text": "The echo shows a small pericardial effusion without tamponade physiology. No wall motion abnormalities. No valve dysfunction. The finding that separates this from the viral pericarditis case is the context: known SLE, known APS, now serositis in a new cavity. The mechanism is immune complex deposition in the pericardium, not a Coxsackie virus. [[5]]"
    },
    {
      "stage": "Take",
      "text": "Dr. Reyes brings up the comparison case without pulling up the chart. A 28 year old man with IV drug use, two day history of fever and chest pain, found to have tricuspid valve endocarditis with septic pulmonary emboli. His chest pain was pleural, positional, and his EKG showed the same diffuse changes. Same presentation. Entirely different disease. The cost of missing the difference is an untreated infection. [[6]]"
    },
    {
      "stage": "Return",
      "text": "The near miss that sharpens Amara's diagnosis is a 72 year old man with prior NSTEMI who returned four weeks later with the same pain and the same EKG. His echo showed regional wall motion abnormality. His diagnosis was reinfarction. Amara's echo shows global pericardial inflammation. The return is not a repetition. It is discrimination. [[7]]"
    },
    {
      "stage": "Change",
      "text": "By the end of this visit Amara has a new diagnosis and a new layer to her understanding of her own disease. Lupus is not one thing. It is a collector of tissues. Joints, then vessels, now pericardium. The next step is colchicine and an adjustment to her immunosuppression. The lesson that sticks is that the same patient, same disease, same emergency department, can produce three entirely different chest pain forks, and she has now walked through two of them. [[8]]"
    }
  ],
  "5": [
    {
      "stage": "You",
      "text": "Amara is stable. Pericarditis resolving. Colchicine on board. She is in the cardiology clinic for a follow up echocardiogram when Dr. Reyes pulls her aside for one more teaching moment before the visit ends. [[1]]"
    },
    {
      "stage": "Need",
      "text": "She wants Amara to understand the final branch of the chest pain fork, the one she has not personally experienced but will encounter in other patients for the rest of her life. GERD and esophageal spasm versus cardiac chest pain. The fork where antacids either win or they absolutely must not. [[2]]"
    },
    {
      "stage": "Go",
      "text": "Dr. Reyes opens the chart of a 62 year old woman with systemic sclerosis, a different connective tissue disease, who presented with progressive dysphagia and retrosternal chest pain after meals. Her pain was esophageal. Her manometry showed absent peristalsis. Her heart was fine. The fork went to the GI lab, not the cath lab. [[3]]"
    },
    {
      "stage": "Search",
      "text": "The trap is the overlap. A 47 year old woman with GERD comes in for routine follow up. Her chest pain is reproducible with palpation. Her EKG is normal. Her antacids work. But a 29 year old woman comes in the same week with a burning sensation in her chest that she describes as heartburn. Her EKG shows anterior ST elevation. Her antacids do not work. Her diagnosis is an acute anterior MI. Same words. Different story. [[4]]"
    },
    {
      "stage": "Find",
      "text": "The finding that separates the two is not in the history. It is in the EKG and the troponin. A 72 year old woman with progressive dysphagia and chest pain had a normal cardiac workup and an esophageal stricture on endoscopy. A 58 year old woman with the same symptoms had esophageal cancer. The fork is deep and each branch has its own next step. [[5]]"
    },
    {
      "stage": "Take",
      "text": "Dr. Reyes closes the teaching tablet and turns to Amara directly. The cost of guessing wrong on GERD versus cardiac is not theoretical. A 32 year old African American woman, same age, same bay, same initial presentation as the GERD patients, turned out to have lupus pericarditis. Amara does not need to be told who that patient was. [[6]]"
    },
    {
      "stage": "Return",
      "text": "The return that closes the loop is the systemic sclerosis patient with esophageal dysmotility whose chest pain was never cardiac. Her disease was collagen deposition in the esophagus, not immune complexes in the pericardium. Different connective tissue disease. Different cavity. Same lesson: the fork does not care what disease you carry. It only cares what questions you ask and in what order. [[7]]"
    },
    {
      "stage": "Change",
      "text": "Amara walks out of the cardiology clinic into the afternoon sun. She has now seen the full chest pain fork from every angle. PE from APS. Pericarditis from lupus. Dissection ruled out. GERD differentiated. She knows the order of the questions and the cost of asking them late. The story does not end here. It continues into her next clinic visit, her next lab draw, and whatever organ her immune system decides to visit next. But she knows how to walk into an emergency department now. She knows what to say and what to ask. She knows the fork. [[8]]"
    }
  ]
};

// Replace in HTML
const storyStart = html.indexOf('const STORY_STEPS = ');
const storyEnd = html.indexOf('\nlet si = 0', storyStart);
const before = html.slice(0, storyStart);
const after = html.slice(storyEnd);

// Update header
let updated = before;
updated = updated.replace(/Nadia &amp; Dr\. Iwu \(placeholder\)/, 'Amara &amp; Dr. Reyes');
updated = updated.replace(
  /<strong>Chest pain — ACS vs PE vs dissection vs pericarditis vs GERD<\/strong>/,
  '<strong>Chest pain — Amara, 32F with SLE+APS, walks: PE → dissection ruled out → pericarditis → GERD differentiated</strong>'
);

// Replace character names globally
updated = updated.replace(/\bNadia\b/g, 'Amara');
updated = updated.replace(/\bDr\. Iwu\b/g, 'Dr. Reyes');

const newHtml = updated + 'const STORY_STEPS = ' + JSON.stringify(newStory, null, 2) + ';\n' + after;
fs.writeFileSync(path.join(__dirname, 'set-02-story-va.html'), newHtml);

console.log('Done. Set 2 story rewritten.');
console.log('Spine nodes:');
console.log('  Scene 1: QID 1960 — 32F SLE, PE from APS');
console.log('  Scene 4: QID 2029 — same patient, pericarditis 6mo later');
console.log('  Scenes 2,3,5: witnessed/taught content (0 spine nodes each)');
