---
status: accepted
---

# Never change a Question to make it fit

A Reading holds each Question exactly as its Question File meant it, or leaves it out with an Import Issue. It never brings a Question in changed. Test Parrot's ADR-0033 did both: it left some questions out and converted others with a note. For a package many apps read, a changed Question that carries a note is one more thing every app must remember to show, and an app that forgets it passes on a question its author never wrote.

The line is content against presentation. A Question whose content would be lost is left out: a picture the file names but does not carry, an equation that cannot be read, a right answer that is missing, or something no Question Type can hold. Presentation the unified form has no words for, such as font, colour, size or underline, is dropped and the Question still comes in. Otherwise most Canvas and Moodle exports, which are HTML, would barely import.

An Import Issue therefore means only “left out”. Each has a stable code, so an app can group, count or explain them however it likes.
