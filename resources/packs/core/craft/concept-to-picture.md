---
name: Concept to picture
description: How to find the one picture that explains an idea: the mechanism, the numbers as countable things, actors doing the work.
---

# Concept to picture

The picture is not an illustration of the topic. It is the mechanism, drawn so the eye can follow cause to effect.
A good picture is one only THIS idea could have: if you could swap the title and reuse the picture for another
idea, it is not the picture yet.

## The method (work it in DESIGN.md)

1. **Say the mechanism in one sentence, with a number in it.** "Every caller gets a bucket of 10 tokens that
   refills one every 6 seconds; a bot at 10 a second empties its bucket in one second, and everything after that is
   refused."
2. **Find the stuff that flows or piles up.** Requests, coins, people, cells, drops, letters. That stuff becomes
   countable objects on the canvas.
3. **Find the container or the limit.** A bucket, a door, a jar, a lane, a gauge with a red line. The limit is
   where the drama is.
4. **Make the numbers into ink.** If the idea says 100 against 20, draw 100 things and 20 things at the same size,
   so the ink ratio IS the number ratio. A number shown only as digits is the weakest version of it.
5. **Give the work to actors.** Whoever does the work (a server, a cell, a cashier) gets a face. The overloaded one
   strains; the fine one relaxes. The viewer reads emotion before text.
6. **Put the comparison on one canvas.** "Without" and "with" one above the other, or the person beside the bot,
   at the same scale.
7. **Pick what frame 0 shows:** the end state, with every payoff visible.

## Three ideas, three pictures

When DESIGN.md lists three ideas, change the METAPHOR, not the colour:

- one literal (the real objects: a bucket, a jar of coins, cells),
- one built from the numbers (a giant number made of the very things it counts),
- one with actors (characters doing the work, their faces carrying the state).

Then pick the one only this idea could have, and say in one sentence why.

## Worked examples (software)

- **Rate limiting → "one bucket per caller."** Five people and a bot each hang a bucket of tokens on a shared pipe;
  each request takes a token; the people's buckets stay full, the bot's is empty and its extra requests bounce off
  into a growing heap with a "refused" sign; below, the AI bill jar stays thin under a dashed "without the limit"
  line.
- **Debounce → "45 letters, 45 searches against 1."** A 45-letter word typed into a search box; without debounce a
  tower of 45 request crates crushes a sweating server; with debounce one timer waits for the pause and one crate
  lands on a relaxed server sipping coffee.
- **Connection pooling → "the number is the doors."** A giant 100 drawn out of exactly 100 doors (the database's
  connection limit) beside a small 20 made of 20 doors (the pool); requests borrow a lit door and hand it back.

## Worked examples (other fields)

- **Herd immunity → "the gaps in the crowd."** A grid of 100 people; an infection hops only between unprotected
  neighbours. With 30 protected it sweeps the grid; with 85 protected it hits a wall of shielded people and dies
  out, and the few who cannot be protected stay safe inside the wall.
- **Inflation → "the shrinking basket."** The same $100 note buys a full basket of groceries in the first column
  and a basket that is visibly emptier each decade after; the note never changes, the basket does.

These are examples of the method, not templates. Never reuse a layout from one of them for a different idea: every
idea gets its own composition.
