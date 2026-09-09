export const subjectGroups = [
 {name:'Studies in language and literature',subjects:['Language A: literature','Language A: language and literature','Literature and performance']},
 {name:'Language acquisition',subjects:['Classical languages','Language ab initio','Language B']},
 {name:'Individuals and societies',subjects:['Business management','Digital society','Economics','Geography','Global politics','History','Philosophy','Psychology','Social and cultural anthropology','World religions']},
 {name:'Sciences',subjects:['Biology','Chemistry','Computer science','Design technology','Environmental systems and societies','Physics','Sports, exercise and health science']},
 {name:'Mathematics',subjects:['Mathematics: analysis and approaches','Mathematics: applications and interpretation']},
 {name:'The arts',subjects:['Dance','Film','Music','Theatre','Visual arts']},
];
export const subjects=subjectGroups.flatMap(g=>g.subjects);
export const categories=['General','Homework help','EE','TOK','CAS','Exams','College'];
export const core = {
 ee:{title:'Extended essay',short:'EE',intro:'A place for your question to grow.',description:'Keep research links, writing resources, and student advice together as your essay develops.',url:'https://ibo.org/programmes/diploma-programme/curriculum/dp-core/extended-essay/'},
 tok:{title:'Theory of knowledge',short:'TOK',intro:'Make room for a different perspective.',description:'Find resources and conversations for exploring how we know what we claim to know.',url:'https://ibo.org/programmes/diploma-programme/curriculum/dp-core/theory-of-knowledge/'},
 cas:{title:'Creativity, activity, service',short:'CAS',intro:'Turn an idea into an experience.',description:'Share activity ideas, project inspiration, and useful resources with the people around you.',url:'https://ibo.org/programmes/diploma-programme/curriculum/dp-core/creativity-activity-and-service/'},
};
export const officialResources=[
 ...Object.values(core).map(c=>({id:c.short,title:c.title+' — official IB overview',body:'Start with the IB’s own guidance, then check your school’s requirements with your coordinator.',subject:c.short,url:c.url,author:'International Baccalaureate'})),
 {id:'subjects',title:'DP subject directory',body:'The six subject groups and links to individual course information.',subject:'General',url:'https://ibo.org/programmes/diploma-programme/curriculum/',author:'International Baccalaureate'},
 {id:'exams',title:'Official examination schedules',body:'Check the published session schedule and confirm your personal exam arrangements with your coordinator.',subject:'General',url:'https://ibo.org/programmes/diploma-programme/assessment-and-exams/exam-schedule/',author:'International Baccalaureate'}
];
export const starterTips=[
 {title:'Leave yourself a next step',body:'Before you close your work, write one concrete thing to do when you reopen it. “Find a quotation for this claim” is easier to start than “work on my essay.”',subject:'General'},
 {title:'Keep a mistake log',body:'After practice, note what went wrong, why it happened, and one change to try next time. Revisit a few of those questions before adding more new ones.',subject:'General'},
 {title:'Put the source beside the note',body:'When you collect an idea or quotation, record its source and page number immediately. Your future self will have one less thing to hunt down.',subject:'EE'},
];
