/* Snuggle Stories — children's audiobook short-story generator.
 * 100% offline: procedural story engine + browser Web Speech API narration.
 * No accounts, no tracking, no network requests.
 *
 * Template mini-language used in the story data below:
 *   {token}      -> story variable (hero, friend, they/them/their, goal, ...)
 *   [a|b|c]      -> pick by age band (3–5 | 6–8 | 9–11)
 *   <a|b|c>      -> pick at random
 */
(function (root) {
  "use strict";

  /* Seeded random so a story number reproduces a story */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var NAMES = {
    she: ["Mia", "Ava", "Zara", "Ruby", "Nora", "Ivy", "Lila", "Amara", "Rosie", "Maya", "Hana", "Elsie", "Lucia", "Willa", "Aisha", "Poppy", "Mei", "Sofia"],
    he: ["Leo", "Noah", "Eli", "Kai", "Omar", "Max", "Jonah", "Arlo", "Felix", "Mateo", "Ezra", "Ollie", "Ravi", "Hugo", "Kofi", "Benji", "Jun", "Oscar"]
  };
  var PRONOUNS = {
    she: { they: "she", them: "her", their: "her", self: "herself" },
    he: { they: "he", them: "him", their: "his", self: "himself" }
  };

  /* Generic story beats shared by every theme */
  var G = {
    opener: [
      "Once upon a time, in {place}, {placeLook}, there lived a [little|curious|wonderfully curious] child named {hero}.",
      "Not so very long ago, in {place}, {placeLook}, lived a child named {hero} who [loved to play|loved to explore|was always eager to discover something new].",
      "In {place}, {placeLook}, there was a [happy|cheerful|bright-eyed and cheerful] child called {hero}.",
      "Far away, but not too far, in {place}, {placeLook}, there lived a [kind|kind and curious|kind, curious, and endlessly imaginative] child named {hero}."
    ],
    heroTrait: [
      "{hero} [liked big hugs and happy songs|liked asking questions, especially the ones that started with 'why'|kept a notebook full of questions, drawings, and half-finished ideas].",
      "{hero} [had a big smile|had a laugh that made everyone else laugh too|had a laugh so cheerful that it could brighten the gloomiest afternoon].",
      "{hero} [was good at helping|was very good at noticing when someone needed help|had a talent for noticing the small things that other people missed]."
    ],
    friendIntro: [
      "{hero}'s best friend was {friend}, {aFriend} {friendTrait}.",
      "Wherever {hero} went, {friend} went too. {friend} was {aFriend} {friendTrait}.",
      "{hero} never went anywhere without {friend}, {aFriend} {friendTrait}."
    ],
    friendFun: [
      "Together, they [played all day|could turn any day into a fun day|could turn even a rainy Tuesday into something special].",
      "[{hero} and {friend} loved to play.|{hero} and {friend} loved games, snacks, and stories.|{hero} and {friend} had a secret handshake that ended with a wiggle and a bow.]",
      "[They were the best of friends.|They shared everything, even the last cookie.|They shared everything, even the last cookie, which, as everyone knows, is the hardest thing to share.]"
    ],
    timeLead: [
      "<One|Then, one> {time}, [something happened|something surprising happened|something rather unexpected happened].",
      "But one {time}, [there was a problem|there was a little problem|there was a little problem that needed solving].",
      "Then, on a [special|very special|perfectly ordinary-seeming] {time}, everything changed."
    ],
    decide: [
      "{hero} looked at {friend}, and {friend} looked at {hero}. '[We can help!|We have to help!|We have to do something,]' they said together. And so they set off to {goal}.",
      "'Don't worry,' said {hero}. '[We will help.|We'll help, I promise.|We'll find a way, I promise.]' And off {they} went with {friend} to {goal}.",
      "{hero} [jumped up.|jumped up, ready to help.|sprang up, already thinking of a plan.] 'Come on, {friend}!' {they} said. 'Let's {goal}!'"
    ],
    journey: [
      "So off they went, [side by side|side by side, smiling|side by side, ready for whatever came next].",
      "[Off they went!|They took a deep breath and off they went.|They took a deep breath, gave each other a nod, and off they went.]"
    ],
    travel: [
      "Along the way, they [sang a walking song|sang a walking song and clapped along|sang a walking song, making up silly new verses as they went]. {friend} sang the high notes, and {hero} sang the low notes, and together it sounded [nice|just right|surprisingly wonderful].",
      "[They looked all around.|As they went, they looked carefully at everything.|As they went, they noticed everything: the colors, the shapes, and the little sounds all around them.] 'Keep your eyes open,' said {hero}. 'We might find a clue.'",
      "'Do you think we can really do it?' asked {friend}. {hero} thought for a moment. '[Yes! We can try.|I think so, if we try our best.|I'm not sure yet, but I know we'll try our very best.]'"
    ],
    midpoint: [
      "By now, [their feet were tired|their feet were getting tired|their feet were tired and their tummies were rumbling], so they stopped for a snack. {hero} broke a cookie in half and gave the bigger piece to {friend}. [Yum!|It tasted extra good after all that work.|Somehow, shared cookies always taste better.]",
      "They sat down on a soft spot to rest. '[We are doing great,|We're doing a great job so far,|We've come such a long way already,]' said {friend}. {hero} nodded. 'Just one more thing to do.'",
      "{hero} looked back at how far they had come and smiled. [Wow!|It was a long way!|It was much farther than {hero} had ever imagined going.] 'Almost there,' {hero} whispered."
    ],
    reflect: [
      "'What was your favorite part?' asked {friend}. '[All of it!|Doing it together,|Honestly? Doing it together,]' said {hero}. '[|That was the best part.|That made every part better.]' {friend} agreed completely.",
      "On the way home, they told the whole story again, from the very beginning. Each time they told it, it got a little [funnier|funnier and a little longer|funnier, a little longer, and a lot more exciting]."
    ],
    reaction: {
      any: [
        "'[Hooray!|We did it!|That worked even better than I hoped!]' cheered {hero}.",
        "{friend} [clapped and cheered|did a happy little spin|let out a cheer that echoed all around].",
        "[High five!|They gave each other a high five.|They shared a proud grin and a high five.]"
      ],
      calm: [
        "{hero} smiled a slow, happy smile. [Step by step.|One small step at a time was working just fine.|Taking things one small step at a time was working beautifully.]",
        "[They rested for a moment.|They sat for a moment and listened to the quiet.|They paused to rest, enjoying the gentle quiet all around them.]"
      ],
      funny: [
        "{friend} did a victory dance that looked a lot like a wobbly noodle.",
        "'I knew we could do it,' said {friend}, 'because I wore my lucky socks.' Then {friend} looked down. There were no socks at all. Everyone giggled.",
        "{hero} laughed so hard that {hero} snorted, and that made {friend} laugh even harder."
      ],
      brave: [
        "{hero} felt {their} heart grow [a little braver|a little bigger and a little braver|a little bigger, a little braver, and a lot more sure of {self}].",
        "'That was brave,' said {friend}. {hero} stood up a little taller."
      ]
    },
    mood: {
      calm: [
        "{hero} took a slow, deep breath in... and a slow, deep breath out. [That felt better.|Everything felt a little calmer.|With each breath, the problem seemed a little smaller.]",
        "[It was quiet.|All around them, it was soft and quiet.|For a moment, everything was soft and still, as if the whole world were resting.]",
        "'Let's [think|think slowly|take our time and think it through],' said {hero} softly."
      ],
      funny: [
        "'Hmm,' said {friend}, thinking so hard that {friend} went a little cross-eyed.",
        "Just then, {friend}'s tummy rumbled so loudly that a bird nearby thought it was thunder.",
        "{hero} giggled. '[This is silly!|This is the silliest problem ever!|This might be the silliest problem in the history of problems!]'",
        "{friend} tried to look serious, but then sneezed. Ah... ah... ah-CHOO! Everyone burst out laughing."
      ],
      brave: [
        "{hero}'s knees felt [wobbly|a bit wobbly|a little wobbly, like jelly on a plate], but {hero} stood up tall. 'I can do brave things,' {they} said.",
        "[Being brave is hard.|Being brave is not always easy.|Being brave doesn't mean you aren't nervous. It means you try anyway.] {hero} took one small step forward.",
        "{friend} [stayed close|stayed close beside {hero}|stayed close, and that made {hero} feel braver already]."
      ]
    },
    moral: [
      "On the way home, {hero} thought about the day. [Being kind made everyone smile.|It's funny how a little kindness can fix a big problem.|It's funny how a little kindness can untangle even a very big problem.]",
      "'You know what?' said {friend}. '[We are a good team.|Things are easier when we do them together.|Hard things feel smaller when you have a friend beside you.]'",
      "{hero} smiled. [Being gentle worked.|Being patient and gentle, {hero} decided, was a kind of superpower.|Patience and gentleness, {hero} decided, were a quiet kind of superpower.]",
      "[Helping felt good.|Helping someone, {hero} thought, is one of the best feelings there is.|Helping someone, {hero} thought, leaves a warm glow that lasts much longer than the day itself.]"
    ],
    ending: {
      calm: [
        "And as the day grew soft and golden, {hero} snuggled in, warm and happy, and closed {their} eyes. Sweet dreams, {hero}.",
        "Later, tucked up cozy, {hero} listened to the quiet and smiled. It had been a very good day."
      ],
      funny: [
        "And {friend} laughed about the whole adventure so much that {friend} hiccupped all the way home. Hic! Hic! Hooray!",
        "That night, {hero} dreamed of dancing noodles, giggling birds, and lucky socks. It was a very silly dream, and a very happy one."
      ],
      brave: [
        "{hero} stood tall and proud. {They} had been brave, and kind, and clever, all in one day.",
        "That night, {hero} fell asleep feeling as brave as a lion, and as gentle as a lamb."
      ]
    },
    chapter1: ["Once Upon a Time", "The Beginning", "Meet {hero}", "A Day Like Any Other"],
    chapterProblem: ["A Little Problem", "Uh-Oh!", "Something Is Not Right", "A Call for Help"],
    chapterEnd: ["Home Again", "A Happy Ending", "All Is Well", "The Best Part"],
    titles: ["{hero} and {qt}", "{QT}", "{hero}, {friend}, and {qt}"]
  };

  /* Themes: places, friends, quests (3 steps each: [chapter title, problem, kind solution]) */
  var THEMES = {
    bedtime: {
      label: "Bedtime", emoji: "🌙", time: ["evening", "night"],
      setup: ["Every night, {hero} looked out {their} bedroom window to say goodnight to the moon.",
              "{hero} had a soft blanket covered in stars, and it was perfect for snuggling."],
      places: [
        ["Willow Lane", "where the houses had round windows and the chimneys puffed little clouds"],
        ["a cozy cottage at the edge of Lavender Hill", "where the air always smelled like warm bread"],
        ["the quiet village of Hushbrook", "where even the river whispered instead of splashing"]
      ],
      friends: [
        ["Pip", "little owl", "who blinked slowly and said 'hoo' whenever something was wonderful"],
        ["Moss", "sleepy hedgehog", "who curled into a ball whenever there was a giggle"],
        ["Luna", "soft gray kitten", "with paws as quiet as snowflakes"]
      ],
      quests: [
        { title: "the Missing Moonbeam", goal: "find the little moonbeam that had wandered away",
          problem: "The moon looked a tiny bit dim. One of its moonbeams had slipped away to play and could not find its way home.",
          steps: [
            ["The Garden Path", "In the garden, the path was so dark that {hero} could hardly see the flowers.", "{friend} remembered the fireflies. {hero} asked them politely, and they lit the way, blinking gold and green."],
            ["The Sleepy Bridge", "At the old wooden bridge, a grumpy badger sat right in the middle, because the creaky boards kept waking him up.", "{hero} hummed a soft lullaby. The badger's eyes grew heavy, he smiled, and he shuffled aside to snooze by the reeds."],
            ["The Tall Pine Tree", "At last they spotted the moonbeam, tangled in the branches of a tall pine tree, too shy to come down.", "{hero} spoke gently. 'Your moon misses you,' {they} said. The moonbeam wiggled free and floated down like a feather."]
          ],
          finale: "{hero} and {friend} held the moonbeam up high, and it zipped back into the sky. The moon glowed bright and round, and it seemed to wink right at them." },
        { title: "the Lullaby Box", goal: "find the lost lullaby",
          problem: "Every night, Grandma's little music box played a lullaby that helped the whole village fall asleep. But tonight, when {hero} turned the tiny key, nothing came out but a sad little click. The song had gone missing!",
          steps: [
            ["The Wind Chimes", "They asked the wind chimes on the porch, but the chimes only knew how to tinkle, not sing.", "Still, the chimes helped as best they could. 'Try the meadow,' they jingled in the breeze."],
            ["The Cricket Choir", "In the meadow, the crickets were practicing, but they had lost the rhythm and were chirping in a big jumble.", "{hero} tapped a slow beat on a log. Tap... tap... tap. The crickets listened, and soon they were chirping together, nice and steady."],
            ["The Hollow Log", "Inside a hollow log, they found the lullaby, curled up and humming to itself. It was tired from playing every single night.", "'You don't have to sing alone,' said {hero}. 'We will all sing with you.' The song brightened and floated into {hero}'s cupped hands."]
          ],
          finale: "Back home, {hero} placed the song gently into the music box. This time, when the key turned, the lullaby played, and {hero}, {friend}, and Grandma sang along softly." },
        { title: "the Star Who Couldn't Sleep", goal: "help a little star fall asleep",
          problem: "High above, one little star was wide awake, twinkling and fidgeting while all the other stars were resting. 'I can't fall asleep,' it called down. 'Can you help me?'",
          steps: [
            ["A Warm Blanket", "First, {hero} thought the star might be cold, so {they} looked for something cozy.", "{friend} found a soft cloud drifting low, and together they tucked it around the star like a fluffy blanket."],
            ["A Cup of Moonmilk", "The star was warm now, but it still wriggled and wiggled.", "{hero} remembered that warm milk always helped at bedtime, so {they} poured a tiny cup of silvery moonmilk from the dewdrops on the grass."],
            ["A Bedtime Story", "The star yawned, but its eyes kept popping open. 'I'm not tired yet,' it said.", "So {hero} told it a quiet story about a sleepy sea and a slow, slow turtle. Before the story was even finished, the star was snoring the tiniest snore."]
          ],
          finale: "The little star glowed softly, peaceful at last, and the whole sky seemed to sigh with happiness." }
      ,
        { title: "the Blanket Fort That Wouldn't Stay Up", goal: "build a cozy blanket fort that stays up",
          problem: "{hero}'s blanket fort kept falling down. Every time the last blanket went on, the whole thing slumped into a soft heap. {friend} sighed. 'How will we ever have a midnight snack in here?'",
          steps: [
            ["Too Floppy", "The chairs wobbled, and the blankets slid off like sleepy noodles.", "{hero} tucked the blanket corners under heavy books. The chairs stood still, and the walls stopped sliding."],
            ["A Dark Spot", "Inside the fort it was cozy, but one corner was pitch-black and a little spooky.", "{friend} brought a tiny night-light shaped like a moon. Soft golden light filled the dark corner, and suddenly it felt friendly."],
            ["The Snack Spill", "When they brought in cookies and milk, a cookie tumbled and almost knocked a wall down again.", "They put the snacks on a flat tray in the middle, far from the walls. The fort held strong. Hooray!"]
          ],
          finale: "{hero} and {friend} crawled inside, whispered stories, and shared every cookie. The fort stayed up all night, soft and steady and full of giggles." },
        { title: "the Soft Socks That Wandered Off", goal: "find the missing soft socks",
          problem: "Every bedtime, {hero} wore the softest pair of socks in the whole house. But tonight, only one sock was under the bed. The other had wandered off!",
          steps: [
            ["Under the Bed", "Under the bed lived dust bunnies and a lonely mitten, but no sock.", "{friend} sniffed around and spotted a trail of tiny fluff leading toward the hallway."],
            ["The Laundry Basket", "In the laundry basket, socks of every color were jumbled together like a sock salad.", "{hero} sorted them patiently, matching pairs one by one. Still no soft sock... until a tiny sneeze came from the dryer lint corner."],
            ["The Cat Nap", "There was Luna the cat, curled around the missing sock like a doughnut.", "'May I please have my sock back?' whispered {hero}. Luna stretched, yawned, and nudged the sock into {hero}'s hands."]
          ],
          finale: "Both soft socks were on {hero}'s feet at last. {hero} wriggled {their} toes and climbed into bed, warm from tip to toe." },
        { title: "the Night-Light That Flickered", goal: "help the night-light shine steady again",
          problem: "The little night-light on {hero}'s shelf kept flickering on and off. On. Off. On. Off. It made funny shadows, and {friend} said, 'I think it's worried about something.'",
          steps: [
            ["A Gentle Ask", "The night-light flickered faster when anyone walked by too loudly.", "{hero} tiptoed close and asked softly, 'What's wrong?' The light glowed a little steadier, as if it liked being asked."],
            ["Dusty Glass", "Its glass cover was covered in a thin gray film of dust.", "{friend} polished it carefully with a soft cloth until it sparkled. The light brightened... then flickered again."],
            ["A Lonely Glow", "The night-light whispered in a tiny hum: it missed the company of other gentle lights.", "{hero} placed a jar of firefly stickers and a tiny glow-star beside it. 'You're not alone,' {they} said. The light shone steady and warm."]
          ],
          finale: "All night long the night-light glowed soft and sure. {hero} fell asleep watching its calm, golden circle on the wall." },
        { title: "the Pillow That Lost Its Whisper", goal: "help the pillow whisper soft dreams again",
          problem: "Grandpa always said {hero}'s pillow whispered soft dream-words at night. But tonight the pillow was silent. Not even a tiny hush.",
          steps: [
            ["Listening Closely", "First they put an ear right on the pillow. Nothing.", "'Maybe it needs a story of its own,' said {friend}. So {hero} told the pillow about a sleepy cloud that floated very slowly."],
            ["Fluffing Time", "The pillow still felt flat and quiet.", "They fluffed it gently, shook it once, and patted it into a soft mountain. A faint whisper returned: hush... hush..."],
            ["A Shared Secret", "The whisper faded again when {hero} climbed into bed alone.", "So {friend} snuggled close for one quiet minute and whispered, 'Sweet dreams.' The pillow hummed back, full of soft words once more."]
          ],
          finale: "That night the pillow whispered the loveliest dreams: sailing ships made of clouds, cookies that never crumbled, and friends who always stayed nearby." }],
      endings: ["Then {hero} climbed into bed, pulled the covers up to {their} chin, and drifted off to sleep, dreaming of soft, silver light.",
                "{friend} gave a big yawn. {hero} gave an even bigger yawn. And soon the whole house was quiet and sleeping. Goodnight, {hero}. Goodnight, {friend}. Goodnight, moon."],
      mood: { calm: ["Above them, the stars twinkled like sprinkles on a dark blue cake."],
              funny: ["{friend} yawned so wide that a moth flew in, looked around, and flew right back out."],
              brave: ["The night was very dark, but {hero} whispered, 'Dark is just the day with its eyes closed.' And that made it feel friendly."] }
    },

    adventure: {
      label: "Adventure", emoji: "🧭", time: ["morning", "afternoon", "sunny morning"],
      setup: ["{hero} kept a backpack by the door, packed with a flashlight, a snack, and a notebook, just in case an adventure came along."],
      places: [
        ["the windy town of Puddleby-by-the-Sea", "where kites danced over the rooftops"],
        ["Maple Valley", "where the hills rolled like green waves"],
        ["the village of Hilltop Hollow", "where every path led somewhere interesting"]
      ],
      friends: [
        ["Biscuit", "scruffy brown puppy", "with one ear that always stood straight up"],
        ["Juniper", "clever red squirrel", "who kept a tiny map tucked behind one ear"],
        ["Captain Waddles", "brave little penguin", "who wore a captain's hat three sizes too big"]
      ],
      quests: [
        { title: "the Golden Compass", goal: "find Mr. Bramble's golden compass",
          problem: "Old Mr. Bramble, the village mapmaker, came hurrying down the lane. 'My golden compass is lost!' he said. 'Without it, I can't finish my map of the valley.' He had last seen it near Whistle Hill.",
          steps: [
            ["The Wobbly Bridge", "To reach Whistle Hill, they had to cross a stream, but the little bridge had a missing plank and wobbled like jelly.", "{hero} and {friend} found a flat, sturdy log and pushed it into the gap. They crossed slowly, one careful step at a time."],
            ["The Riddle Gate", "Next they came to a gate with a sign: 'To open me, answer my riddle. What has hands but cannot clap?'", "{hero} thought and thought. 'A clock!' {they} said. The gate creaked open with a cheerful squeak."],
            ["Whistle Hill", "At the top of Whistle Hill, the wind went whoosh, and something shiny glinted inside a magpie's nest.", "The magpie loved shiny things, so {hero} offered a bright button from {their} pocket instead. The magpie happily traded, and the golden compass was found."]
          ],
          finale: "Mr. Bramble was so happy that he did a little jig. He drew a brand-new spot on his map and labeled it in curly letters: {hero}'s Lookout." },
        { title: "the Lighthouse Treasure", goal: "find the treasure in the old lighthouse",
          problem: "{hero} found a bottle on the beach with a crumpled note inside. It said: 'Treasure waits at the top of the old lighthouse. Bring a friend.'",
          steps: [
            ["The Sandy Path", "The path to the lighthouse was covered by the tide, and the water was rising.", "{friend} spotted a row of big, flat stones, and they hopped across them like stepping stones. Hop, hop, hop!"],
            ["The Spiral Stairs", "Inside, the lighthouse stairs went round and round and round. There were one hundred steps!", "'Let's count together,' said {hero}. Counting made the climb feel like a game, and before they knew it, they were at the top."],
            ["The Seashell Lock", "At the top sat a small wooden chest with a lock shaped like a seashell.", "{hero} remembered the seashell from the beach. It fit perfectly! Inside lay two shiny explorer badges and a note: 'The real treasure is the adventure you shared.'"]
          ],
          finale: "{hero} and {friend} pinned on their badges and watched the sunset from the top of the lighthouse, feeling like the luckiest explorers in the world." },
        { title: "the Runaway Kite", goal: "bring back Rosa's rainbow kite",
          problem: "Little Rosa from next door was crying. Her beautiful rainbow kite had snapped its string and floated away over the hills.",
          steps: [
            ["The Sunflower Field", "The kite had drifted over a field of sunflowers so tall that {hero} could not see over them.", "{friend} climbed up onto {hero}'s shoulders and spotted the kite fluttering in the distance. 'This way!'"],
            ["The Chocolate Puddle", "Next was a puddle so big and so muddy that it looked like a chocolate lake.", "Instead of splashing through, they found a path around it. It took a little longer, but their shoes stayed clean. Well, mostly clean."],
            ["The Old Oak Tree", "At last they found the kite, caught in the branches of an old oak tree, just out of reach.", "{hero} found a long stick with a hook at the end, and with one careful tug, the kite floated down into {their} arms."]
          ],
          finale: "When they gave Rosa her kite, her face lit up like sunshine. That afternoon, all three of them flew it together, high over the hills." }
      ,
        { title: "the Map That Got Wet", goal: "fix Mr. Finch's soggy map",
          problem: "Mr. Finch the postman waved a dripping paper. 'My valley map fell in a puddle!' he cried. 'I can't read the paths to deliver the birthday parcels.'",
          steps: [
            ["Puddle Paper", "The ink had run into blue blobs. North looked like a blueberry.", "{hero} carefully blotted the map with a dry scarf. Some lines came back, but not all."],
            ["Asking the Landmarks", "They walked to the big oak and the red barn to check what the map should say.", "{friend} pointed. 'The oak is here, the barn is there.' {hero} redrew the missing paths with a stubby pencil."],
            ["A Test Walk", "Would the new map work? They chose the trickiest parcel first.", "Following their fresh lines, they found every door. Mr. Finch beamed. 'Better than before!'"]
          ],
          finale: "Every birthday parcel arrived on time. Mr. Finch pinned a tiny gold star sticker on {hero}'s backpack that said Official Map Helper." },
        { title: "the Picnic Basket That Rolled Away", goal: "catch the runaway picnic basket",
          problem: "On the way to Lookout Rock, the picnic basket tipped, bounced, and rolled down the hill. Sandwiches, apples, and a jug of lemonade went bouncing after it!",
          steps: [
            ["The Bumpy Hill", "The basket was rolling fast, and the apples were faster.", "{hero} and {friend} ran alongside, scooping apples into their arms like jugglers. Not a single one got bruised."],
            ["The Sticky Patch", "The lemonade jug had sprung a tiny leak, making a sticky trail on the grass.", "They mopped it with napkins and propped the jug upright in a hollow. The trail stopped."],
            ["The Bushy Stop", "At the bottom, the basket was wedged under a blackberry bush, just out of easy reach.", "Using a long stick, they gently nudged it free. Inside, the sandwiches were a little tilted, but still delicious."]
          ],
          finale: "At Lookout Rock they ate every crumb and watched kites dance overhead. 'Best picnic ever,' said {friend}, 'even if it went on an adventure first.'" },
        { title: "the Wobbly Stepping Stones", goal: "make a safe path across Brook Bend",
          problem: "The stepping stones across Brook Bend had shifted after the rain. One stone rocked, another had sunk, and the schoolkids couldn't get to the other side without muddy shoes.",
          steps: [
            ["Looking Closely", "Rushing would make someone slip. The water wasn't deep, but it was chilly.", "{hero} tested each stone with a stick first. 'This one is solid. That one wobbles.'"],
            ["A Team Push", "The sunken stone needed a lift, but it was heavy.", "Three neighbors, {hero}, and {friend} all pushed together. Heave! The stone settled on a firmer spot."],
            ["A Practice Cross", "Would the path hold? Someone had to try it carefully.", "{hero} crossed slowly, arms out for balance, while {friend} cheered from the bank. Safe and dry!"]
          ],
          finale: "By afternoon a neat row of steady stones led across the brook. Kids hopped over singing, and nobody got muddy shoes." },
        { title: "the Echo That Needed Company", goal: "cheer up the lonely echo in Whisper Cave",
          problem: "Whisper Cave used to answer every hello with a friendly echo. Today it stayed silent. A little sign at the entrance read: 'Echo feeling lonely. Please visit.'",
          steps: [
            ["A Soft Hello", "Shouting felt wrong. The cave was dark and quiet.", "{hero} whispered, 'Hello, Echo.' A tiny, shy voice whispered back, '...ello.'"],
            ["Sharing Sounds", "The echo only knew a few words and felt bored of repeating the same ones.", "{friend} taught it new sounds: a giggle, a clap pattern, and a silly sneeze. Ah-CHOO! The cave ah-CHOO'd back."],
            ["A Promise to Return", "Echo brightened, but worried visitors might forget again.", "{hero} left a painted pebble that said 'We'll be back.' Echo bounced the promise all around the cave walls."]
          ],
          finale: "From then on, Whisper Cave answered every visitor with giggles, claps, and cheerful hellos. Echo was never lonely for long." }],
      endings: ["That night, {hero} fell asleep with a big smile, already dreaming about the next adventure.",
                "{hero} wrote everything down in {their} notebook, then drew a little star at the bottom of the page. It had been a five-star adventure."],
      mood: { calm: ["A soft breeze rustled the leaves, and a bird sang a happy tune."],
              funny: ["{friend} tried to read the map, but it was upside down. 'Oh,' said {friend}. 'That explains why the cows were on the ceiling.'"],
              brave: ["'Explorers don't give up,' said {hero}, tightening the straps of {their} backpack."] }
    },

    animals: {
      label: "Animals", emoji: "🐾", time: ["morning", "afternoon", "bright morning"],
      setup: ["{hero} had a special gift: {hero} could understand what animals were saying, if {hero} listened very closely."],
      places: [
        ["Sunnybrook Farm", "where the barn was red and the fields were full of clover"],
        ["a cottage at the edge of the Whispering Woods", "where rabbits, deer, and foxes lived side by side"],
        ["Buttercup Meadow", "where the grass was soft and the bees hummed all day"]
      ],
      friends: [
        ["Daisy", "gentle spotted calf", "who mooed in a very polite way"],
        ["Rufus", "bouncy golden puppy", "whose tail never stopped wagging"],
        ["Hazel", "little brown bunny", "with the twitchiest nose in the whole meadow"]
      ],
      quests: [
        { title: "the Littlest Duckling", goal: "find Dot the duckling",
          problem: "Mother Duck was quacking with worry. 'One, two, three, four,' she counted. 'Where is my littlest duckling, Dot?'",
          steps: [
            ["The Busy Barnyard", "They asked the chickens, but the chickens were all clucking at once, and nobody could hear a thing.", "{hero} said, 'One at a time, please.' The chickens took turns, and the speckled hen remembered seeing Dot waddle toward the pond."],
            ["The Tall Grass", "The grass by the pond was so tall that Dot could be anywhere.", "{hero} had an idea. 'Let's be very quiet and listen.' Everyone hushed. Then, faintly, they heard it: peep... peep... peep."],
            ["The Lily Pad", "There was Dot, sitting on a lily pad in the middle of the pond, too nervous to swim back.", "{friend} called out kindly, 'You can do it, Dot! We're right here.' Dot took a deep breath, paddled her tiny feet, and swam all the way to shore."]
          ],
          finale: "Mother Duck tucked Dot under her wing, and the whole duck family quacked a thank-you song for {hero} and {friend}." },
        { title: "the Grumpy Goat", goal: "find out why Gus the goat was so grumpy",
          problem: "Gus the goat had been grumpy all week. He stomped, he huffed, and he wouldn't play with anyone. 'Something must be wrong,' said {hero}.",
          steps: [
            ["Asking Around", "The pigs said Gus was just a grump. The sheep said he had always been a grump. But {hero} wasn't so sure.", "'Maybe nobody has asked him what's wrong,' said {hero}. So they decided to visit Gus themselves."],
            ["A Gentle Question", "When they reached Gus's pen, he turned his back and huffed, 'Go away.'", "{hero} sat down quietly and waited. After a while, {hero} said, 'We just want to know if you're okay.' Gus's ears drooped. 'My bell is lost,' he said. 'It was a present from my mama.'"],
            ["The Hay Pile", "They searched the barn high and low, but the bell was nowhere to be seen.", "Then {friend} heard a tiny jingle from the hay pile. They dug and dug, and there it was: Gus's little silver bell!"]
          ],
          finale: "When {hero} tied the bell back onto Gus's collar, he did a happy hop and a kick, and for the first time all week, Gus the goat smiled." },
        { title: "the Big Meadow Picnic", goal: "help the animals plan the perfect picnic",
          problem: "The meadow animals wanted to have a big picnic, but they could not agree on anything. The rabbits wanted carrots, the squirrels wanted acorns, and the bears wanted honey.",
          steps: [
            ["Too Many Ideas", "Everyone was talking at once, and the picnic plan was a big muddle.", "{hero} said, 'What if everyone brings one favorite food to share?' The animals looked at each other and nodded."],
            ["The Tiny Blanket", "But the picnic blanket was far too small for so many animals!", "{friend} had an idea. The birds brought leaves, the rabbits brought soft moss, and together they made one giant green blanket."],
            ["The Little Rain Cloud", "Just as they sat down, a little gray cloud drifted over and began to sprinkle.", "The beavers quickly built a roof of branches, and everyone squeezed underneath, giggling as the raindrops pattered on top."]
          ],
          finale: "When the cloud floated away, a rainbow appeared. Everyone shared carrots, acorns, honey, and berries, and it was the very best picnic the meadow had ever seen." }
      ,
        { title: "the Sheep Who Lost Its Cap", goal: "find Woolly's knitted cap",
          problem: "Woolly the sheep loved a tiny red knitted cap that kept her ears warm. This morning the cap was gone, and Woolly's ears felt chilly and sad.",
          steps: [
            ["The Windy Field", "Yesterday had been windy. Caps can fly.", "They followed the fence line where the wind usually blew. A robin chirped and pointed its beak toward the orchard."],
            ["The Apple Orchard", "Under the apple trees they found a mitten, a ribbon, and a leaf that looked like a boat — but no cap.", "{friend} sniffed a woolly scent near the scarecrow. The scarecrow was wearing Woolly's cap on its head!"],
            ["A Polite Swap", "The scarecrow looked rather proud of the red cap.", "{hero} offered a bright yellow scarf instead. The scarecrow nodded (well, tipped a little), and Woolly got her cap back."]
          ],
          finale: "Woolly's ears were warm again. She gave {hero} a gentle woolly nudge and trotted off humming a little baah-baah tune." },
        { title: "the Rooster Who Crowed Too Early", goal: "help Corky crow at the right time",
          problem: "Corky the rooster had been crowing at midnight, at two in the morning, and again before dawn. The whole farm was sleepy and grumpy.",
          steps: [
            ["A Kind Chat", "Nobody wanted to scold Corky. He was trying his best.", "{hero} sat beside him and asked, 'Do you know when morning starts?' Corky blinked. 'When I feel like singing?'"],
            ["A Sunrise Cue", "Corky needed a clearer signal than a feeling.", "They hung a little chime outside the coop that only rang when the first light touched it. Ting!"],
            ["Practice Night", "That night everyone waited nervously.", "Corky stayed quiet until the chime sang. Then he crowed the most beautiful, perfectly-timed COCK-A-DOODLE-DOO the farm had ever heard."]
          ],
          finale: "The farm slept through the night and woke smiling. Corky got an extra scoop of corn for being such a careful timekeeper." },
        { title: "the Nest That Needed Mending", goal: "help Pippa the sparrow fix her nest",
          problem: "A spring gust had tugged half the twigs from Pippa the sparrow's nest. Eggs weren't in it yet, but soon they would be, and the nest looked wobbly.",
          steps: [
            ["Gathering Soft Things", "Pippa could carry only tiny bits in her beak.", "{hero} and {friend} gathered moss, soft grass, and safe bits of yarn from the garden shed."],
            ["Too Wobbly Still", "Even with new twigs, one side dipped like a hammock.", "They wove the yarn in and out while Pippa tucked moss into the gaps. The nest grew round and snug."],
            ["A Weather Test", "A little drizzle began. Would the nest hold?", "Everyone watched. Not a twig shifted. Pippa hopped in a happy circle and chirped thank-you notes."]
          ],
          finale: "Weeks later, tiny peeps came from the nest. Pippa's babies were safe and warm, thanks to teamwork and careful paws and hands." },
        { title: "the Puppy Who Hid the Balls", goal: "find where Scout hid everyone's play balls",
          problem: "Scout the puppy loved games, but he had a habit: after fetch, he hid the balls. Today the farm animals had zero balls left for playtime.",
          steps: [
            ["Following Paw Prints", "Muddy paw prints zigzagged across the yard.", "{hero} and {friend} followed them to the woodpile, the flower pot, and the shady porch."],
            ["A Gentle Dig", "Under the porch steps something rolled. Clunk.", "They reached carefully and pulled out three balls, a stick, and someone's missing shoe. Scout looked sheepish."],
            ["A Better Habit", "Scout still wanted to 'keep' things safe.", "They made a special toy box labeled Scout's Treasures. Now he could put toys away without hiding them forever."]
          ],
          finale: "Playtime returned with bouncing, rolling, and laughing. Scout wagged so hard his ears flapped like little flags." }],
      endings: ["That evening, the animals gathered to say goodnight, and {hero} gave every one of them a gentle pat.",
                "As the sun went down, {hero} heard a hundred tiny voices saying thank you: moos and quacks and chirps and squeaks."],
      mood: { calm: ["A butterfly landed on {hero}'s hand, opened its wings, and closed them again, slowly."],
              funny: ["A cow said 'moo' so loudly that {friend} jumped right into a pile of hay and came out looking like a scarecrow."],
              brave: ["'Animals need us to be gentle and brave,' {hero} whispered to {friend}."] }
    },

    friendship: {
      label: "Friendship", emoji: "🤝", time: ["morning", "afternoon", "school day"],
      setup: ["{hero} liked lots of things: drawing, dancing, and silly jokes. But most of all, {hero} liked spending time with friends."],
      places: [
        ["the town of Pebble Creek", "where the library had a reading nook shaped like a boat"],
        ["Rainbow Street", "where every house was painted a different color"],
        ["Little Oak", "where the school playground had a slide shaped like a dragon"]
      ],
      friends: [
        ["Milo", "giggly classmate", "who could whistle any song"],
        ["Priya", "friendly neighbor", "who knew every bird by its song"],
        ["Theo", "thoughtful friend from down the street", "who built amazing things out of cardboard"]
      ],
      quests: [
        { title: "the New Kid", goal: "help the new kid feel welcome",
          problem: "A new kid named Sam arrived. Sam stood by the fence all alone, holding a backpack tight and looking at the ground.",
          steps: [
            ["Saying Hello", "{hero} wanted to say hello, but {hero}'s tummy felt fluttery. What if Sam didn't want to talk?", "{friend} whispered, 'Let's go together.' So they walked over, and {hero} said, 'Hi! I'm {hero}. Want to play?' Sam looked up and gave a small smile."],
            ["Something in Common", "At first, Sam was very quiet, and nobody knew what to talk about.", "Then {hero} noticed a dinosaur sticker on Sam's backpack. 'I love dinosaurs too!' {hero} said. Suddenly, Sam had lots to say."],
            ["The Team Game", "At playtime, the other kids were picking teams, and Sam looked worried about being left out.", "'Sam is on our team,' said {hero} right away. They played tag and laughed until their cheeks hurt."]
          ],
          finale: "At the end of the day, Sam waved goodbye and said, 'This was the best first day ever.' And {hero} knew that there was a brand-new friend in town." },
        { title: "the Tumbling Tower", goal: "make things right again",
          problem: "{hero} and {friend} were building the tallest block tower ever. But when {friend} reached up to add the very top block, the whole tower came tumbling down. Clatter, clatter, crash!",
          steps: [
            ["Big Feelings", "{hero} felt hot and cross. 'You knocked it over!' {hero} said. {friend} looked down at the floor, and {hero} could see that {friend} felt sad too.", "{hero} took three slow breaths, in and out. Little by little, the cross feeling got smaller."],
            ["Saying Sorry", "Nobody spoke for a while. It was very quiet and a little uncomfortable.", "Then {friend} said, 'I'm sorry I knocked it down.' And {hero} said, 'I'm sorry I shouted.' They both felt lighter right away."],
            ["A Better Tower", "Now there was a big pile of blocks all over the floor.", "'Let's build it again,' said {hero}. 'You do the bottom, and I'll do the top.' Working together, they built a tower even taller than before."]
          ],
          finale: "They named it the Friendship Tower, and when it was finished, they gave each other a high five so big it went SMACK!" },
        { title: "the Birthday Surprise", goal: "give Mrs. Penny a birthday she would never forget",
          problem: "Old Mrs. Penny, who lived at the end of the street, was having a birthday. But {hero} had heard her say, a little sadly, 'Nobody remembers my birthday anymore.'",
          steps: [
            ["The Plan", "{hero} and {friend} had lots of ideas, but no money for a big present.", "'Presents don't have to cost money,' said {hero}. 'We can make something from the heart.'"],
            ["The Paint Splotch", "They made a giant card, but then they spilled blue paint all over the front. Oh no!", "{friend} turned the paint splotch into a big blue bird. It looked even better than before!"],
            ["Knocking on Doors", "One card felt a little small for such a special birthday.", "So they knocked on doors up and down the street, and every neighbor added a message, a drawing, or a flower."]
          ],
          finale: "When Mrs. Penny opened her door and saw everyone singing 'Happy Birthday,' her eyes sparkled with happy tears. 'You remembered,' she said softly. 'You all remembered.'" }
      ,
        { title: "the Crayon That Broke in Half", goal: "share the last blue crayon fairly",
          problem: "Art time! But there was only one blue crayon left, and both {hero} and {friend} needed blue for the sky. Then — snap! — the crayon broke in half.",
          steps: [
            ["Big Feelings", "For a second, both friends felt disappointed.", "{hero} took a breath. 'We still have two pieces. That's actually lucky.'"],
            ["Fair Shares", "One piece was bigger than the other.", "They measured with a finger, then traded turns: one colored while the other chose the next color from the box."],
            ["A Shared Sky", "Separately, their skies looked patchy.", "They put the papers side by side and blended the blues together into one wide, beautiful sky."]
          ],
          finale: "Their teacher hung both pictures as one mural called Friends Share the Sky. {hero} and {friend} grinned the same grin." },
        { title: "the Shy Playdate", goal: "help a quiet playdate feel easy",
          problem: "Jamie came over to play, but sat on the couch holding a stuffed fox and saying almost nothing. The room felt too quiet.",
          steps: [
            ["No Pressure", "Asking a hundred questions made Jamie quieter.", "{hero} sat nearby and started a simple puzzle without demanding talk. {friend} hummed a soft tune."],
            ["A Bridge Toy", "Jamie's eyes kept flicking to the building blocks.", "'Want to make a bridge for your fox?' {hero} offered. Jamie nodded and placed one careful block."],
            ["Finding Words", "Soon the fox needed a name and a road and a snack shop.", "Jamie whispered ideas. Then spoke them. Then laughed when the fox 'drove' across the block bridge."]
          ],
          finale: "By snack time Jamie was chatting about fox adventures. Sometimes friendship starts soft and quiet, then grows." },
        { title: "the Library Book That Hid", goal: "find the overdue library book",
          problem: "The library book about friendly dragons was due today, but it was nowhere on the shelf. {hero}'s tummy did a worried flip.",
          steps: [
            ["Retracing Days", "Where had they read it last?", "{friend} remembered the blanket fort, the kitchen table, and the car ride. They checked each place calmly."],
            ["A Clever Clue", "A receipt from the library stuck out of a backpack pocket.", "Behind the backpack, wedged between the wall and a board game, was the dragon book!"],
            ["Making It Right", "They still had to return it before closing.", "They hurried kindly — no running indoors — and arrived with five minutes to spare. The librarian smiled."]
          ],
          finale: "The dragon book went home to the library, and {hero} checked out a new one about brave mice. Responsibility felt surprisingly good." },
        { title: "the Two Birthdays Mix-Up", goal: "celebrate two birthdays without leaving anyone out",
          problem: "Mina and Leo both had birthdays on the same Saturday. The class could only bake one cake. Everyone started arguing about chocolate versus vanilla.",
          steps: [
            ["Listening First", "Voices got loud. Feelings got bigger.", "{hero} raised a hand. 'Let's hear why each flavor matters.' Mina loved chocolate swirls. Leo loved vanilla sprinkles."],
            ["A Both Idea", "Picking only one still felt unfair.", "{friend} suggested a half-and-half cake. Chocolate on one side, vanilla on the other, sprinkles on both!"],
            ["Two Songs", "They almost sang Happy Birthday once and forgot a name.", "They sang it twice, once for Mina and once for Leo, and both kids blew out the candles together."]
          ],
          finale: "Nobody felt left out. The cake tasted like teamwork, and the classroom smelled like sprinkles and smiles." }],
      endings: ["{hero} and {friend} walked home together, swinging their arms and humming the same happy tune.",
                "That night, {hero} drew a picture of the day: lots of smiling faces, all holding hands."],
      mood: { calm: ["{hero} listened carefully, the way good friends do."],
              funny: ["{friend} made a face so silly that a passing dog sat down and tilted its head."],
              brave: ["Sometimes the bravest thing is to be the first one to say hello."] }
    },

    space: {
      label: "Space", emoji: "🚀", time: ["night", "starry night", "evening"],
      setup: ["{hero} had a cardboard rocket ship in the backyard. Most days it was just a box, but on special nights, it could really fly."],
      places: [
        ["the town of Starfield", "where the night sky was full of twinkling lights"],
        ["a little house with a telescope on the roof", "where you could see all the way to the moon"],
        ["Rocket Ridge", "where everyone dreamed of flying to the stars"]
      ],
      friends: [
        ["Bleep", "small silver robot", "whose lights blinked pink when happy"],
        ["Comet", "space puppy in a bubble helmet", "who barked in beeps"],
        ["Zib", "friendly little alien with three eyes", "who giggled in rainbow colors"]
      ],
      quests: [
        { title: "the Littlest Planet", goal: "help Pebble the planet get home",
          problem: "A tiny voice crackled through {hero}'s walkie-talkie. 'Help! I'm Pebble, the littlest planet. I've drifted away and I can't find my way back to my sun!'",
          steps: [
            ["Blast Off", "First, they needed to fly, but the cardboard rocket had no fuel.", "{friend} pressed a glowing button, and the rocket filled up with starlight. 'Three, two, one... blast off!' cried {hero}, and up they zoomed."],
            ["The Space Rocks", "Soon they reached a field of bumpy space rocks, bouncing every which way.", "{hero} steered slowly and carefully, left, then right, then left again, until they were safely through."],
            ["The Long Way Home", "At last they found Pebble, floating all alone and shivering in the cold dark.", "{hero} tied a ribbon of stardust from the rocket to Pebble and gently towed the little planet back to its warm, glowing sun."]
          ],
          finale: "Pebble spun happily around its sun again. 'Thank you!' it called, and all the stars twinkled as if they were clapping." },
        { title: "the Moon Garden", goal: "help the moon garden grow",
          problem: "They flew to the moon and found a little moon-rabbit looking very sad. 'My moon garden won't grow,' it sniffed. 'Nothing grows without water.'",
          steps: [
            ["Looking for Water", "The moon was dusty and dry, with no rivers and no rain anywhere.", "{friend}'s scanner beeped. 'There's ice hiding in the shady craters!' And there it was, sparkling in the shadows."],
            ["The Frozen Ice", "But the ice was frozen as hard as a rock.", "{hero} held up a shiny mirror to catch the sunlight, warming the ice until it melted into a little silver puddle."],
            ["Planting Seeds", "The seeds were tiny, and the moon dust kept floating away in little puffs.", "They patted the dust down gently, planted each seed, and gave them all a drink. Then they waited... and waited... and pop! Tiny glowing sprouts appeared."]
          ],
          finale: "Soon the moon garden bloomed with silver flowers that shone in the dark. The moon-rabbit hopped for joy, so high that it nearly floated into space." },
        { title: "the Missing Stars", goal: "find the three missing stars",
          problem: "{hero} looked through the telescope and gasped. The Big Dipper was missing three of its stars! The sky looked like a puzzle with pieces missing.",
          steps: [
            ["The Comet's Tail", "The first star had gotten caught on the long, sparkly tail of a speeding comet.", "{hero} waved and called out, 'Excuse me, Mr. Comet!' The comet slowed down, wiggled its tail, and the star popped free."],
            ["The Space Cloud", "The second star was hiding inside a big puffy space cloud, playing hide-and-seek.", "'Found you!' giggled {friend}. The star laughed a twinkly laugh and came out to join them."],
            ["The Sleepy Star", "The third star had simply fallen asleep on a quiet little moon.", "{hero} woke it very gently with a soft song. The star stretched, yawned, and floated up to join the others."]
          ],
          finale: "With all three stars back in place, the Big Dipper shone brighter than ever. Down on Earth, people looked up and said, 'Ooh, look how beautiful the sky is tonight!'" }
      ,
        { title: "the Lonely Satellite", goal: "help a small satellite feel useful again",
          problem: "A tiny satellite named Beep floated in a slow circle, lights dim. 'Nobody needs my signals anymore,' Beep crackled sadly over the radio.",
          steps: [
            ["Listening to Beep", "First they flew close and really listened.", "Beep explained it used to help lost hikers by bouncing messages. Lately the sky felt crowded and quiet."],
            ["A New Job", "Earth still needed gentle helpers.", "{hero} connected Beep to a network of weather balloons that sent soft hello-pings to lonely research stations."],
            ["A Test Ping", "Would anyone answer?", "Ping... ping... a polar station replied with a cheerful thank-you tune. Beep's lights blinked bright pink."]
          ],
          finale: "Beep orbited proudly, busy and needed. {hero} waved from the rocket window as the little satellite winked back." },
        { title: "the Asteroid That Wanted Friends", goal: "help Rocky the asteroid make friends",
          problem: "Rocky the asteroid tumbled past the rocket looking gloomy. 'Everyone zooms away from me,' Rocky rumbled. 'I think they're scared I'll bump them.'",
          steps: [
            ["A Careful Hello", "Getting too close too fast would be unkind.", "{hero} matched Rocky's slow tumble and said hello from a polite distance."],
            ["Showing Soft Sides", "Rocky thought being rocky meant being rough.", "{friend} noticed sparkling crystal patches on Rocky's side. 'You're beautiful,' {friend} said. Rocky blushed a dusty pink."],
            ["A Friend Orbit", "Rocky needed company that wouldn't flee.", "They invited two friendly moonlets to orbit nearby in a gentle dance. No bumps — just waves."]
          ],
          finale: "Rocky laughed a gravelly laugh. Having friends nearby made space feel warmer, even without a sun of his own." },
        { title: "the Gravity Mix-Up", goal: "fix the ship's gentle gravity button",
          problem: "Inside the cardboard-turned-real rocket, the gravity button stuck. Socks floated up. Crackers orbited {friend}'s head. Snack time became a mess!",
          steps: [
            ["Catching Crumbs", "Floating crumbs are funny until they get in your eyes.", "{hero} used a soft net bag to scoop snacks while {friend} corralled the socks."],
            ["Finding the Stuck Switch", "The gravity dial was jammed with sticky jam from lunch.", "They cleaned it gently with a damp cloth. The dial wiggled free."],
            ["A Soft Landing", "Turning gravity on too fast would make everything plummet.", "{hero} turned the dial slowly. Socks drifted down. Crackers settled. Everyone cheered in a whisper so crumbs wouldn't jump again."]
          ],
          finale: "Snack time resumed the normal way — on plates. {friend} still giggled whenever a raisin remembered how to float for half a second." },
        { title: "the Constellation Puzzle", goal: "put the scrambled constellation back together",
          problem: "The stars in the Friendly Fox constellation had slipped out of place. Instead of a fox, the sky looked like a confused pretzel.",
          steps: [
            ["Star Chart Check", "They unrolled an old star chart from the rocket glove box.", "{hero} matched the brightest star first. 'This one is the nose,' {they} said."],
            ["Patient Placing", "Stars are shy about being told where to go.", "{friend} asked each star politely to scoot a little left or right. The stars twinkled yes and slid into place."],
            ["The Missing Tail Tip", "One tiny star for the fox's tail tip was still missing.", "It had been playing tag with a meteor. They called it home with a gentle whistle, and the fox shape returned."]
          ],
          finale: "Down on Earth, kids pointed up and said, 'There's the Friendly Fox!' {hero} smiled, knowing the sky's puzzle was complete." }],
      endings: ["The rocket landed softly in the backyard with a gentle bump. {hero} climbed out, looked up at the stars, and waved goodnight.",
                "Back on Earth, {hero} yawned a big, space-sized yawn. Being an astronaut was wonderful, and very tiring."],
      mood: { calm: ["Out in space, everything floated slowly and silently, like feathers on a warm breeze."],
              funny: ["{friend} tried to eat a snack, but the crumbs floated away, so {friend} chased them around the rocket going, 'Nom, nom, nom!'"],
              brave: ["Space was very big, and {hero} was very small. But {hero} had a big heart, and that was enough."] }
    },

    sea: {
      label: "Under the Sea", emoji: "🐠", time: ["morning", "sunny morning", "afternoon"],
      setup: ["{hero} had a magic seashell necklace. Whenever {hero} held it, {hero} could breathe underwater and talk to sea creatures!"],
      places: [
        ["a seaside town called Shellbridge", "where the waves sang hello every morning"],
        ["a little blue house by Coral Cove", "where the water was warm and the fish wore every color of the rainbow"],
        ["Bubble Bay", "where tiny bubbles rose up like strings of pearls"]
      ],
      friends: [
        ["Shelly", "gentle sea turtle", "who was a hundred years old and never in a hurry"],
        ["Finn", "chatty little clownfish", "who told jokes that made the coral giggle"],
        ["Inky", "shy baby octopus", "who turned pink whenever someone said hello"]
      ],
      quests: [
        { title: "the Great Glowing Pearl", goal: "make the Great Pearl glow again",
          problem: "The Great Pearl that lit up the reef had stopped glowing! Without its soft light, the reef was dim and gray, and the little fish felt gloomy.",
          steps: [
            ["The Wise Old Whale", "Nobody knew why the pearl had stopped glowing, so they swam to ask the wise old whale.", "The whale sang a long, low song. 'The pearl glows when it hears laughter,' she said. 'Perhaps the reef has forgotten how to laugh.'"],
            ["The Gloomy Fish", "But all the fish were too gloomy to laugh, swimming in slow, sad circles.", "{friend} told a joke: 'Why did the crab never share? Because it was shellfish!' A little fish giggled. Then another. Soon the whole reef was laughing."],
            ["The Glow Returns", "The pearl flickered, just a tiny bit, but it wasn't quite bright enough.", "{hero} had an idea. Everyone made the silliest faces they could. The puffer fish puffed, the octopuses wiggled, and the laughter grew so loud that the pearl shone brighter than ever."]
          ],
          finale: "The reef sparkled with color again. From then on, the fish made sure to laugh every single day, just to keep the pearl happy." },
        { title: "the Tangled Dolphin", goal: "help Splash swim free",
          problem: "A young dolphin named Splash had gotten tangled in an old fishing net. She wasn't hurt, but she couldn't swim free to play with her friends.",
          steps: [
            ["The Speedy Current", "Splash was far away near the kelp forest, and they needed to get there quickly.", "A friendly school of fish showed them a speedy current, and {hero} and {friend} zoomed along beside them. Whoosh!"],
            ["The Kelp Forest", "The kelp forest was thick and wavy, and it was easy to get mixed up.", "{hero} followed Splash's happy clicks. Click, click, whistle! They found her right in the middle."],
            ["The Knotty Net", "The net was tied in lots of tight, twisty knots.", "A kind crab snipped with its claws, {friend} wiggled the loops loose, and {hero} spoke softly to keep Splash calm. Snip, wiggle, snip... free!"]
          ],
          finale: "Splash leaped out of the water in a happy arc and splashed them all. Then {hero} rolled up the old net to take home, so it could never tangle anyone again." },
        { title: "the Map in a Bottle", goal: "follow the treasure map",
          problem: "A shiny glass bottle floated down to the sandy sea floor. Inside was a map, with an X marking a secret spot on the reef.",
          steps: [
            ["The Seaweed Maze", "The map led into a maze of swaying seaweed, with paths going every which way.", "{friend} had a great idea: they followed a line of little starfish that seemed to point the way."],
            ["The Sleepy Seahorse", "Next, the path was blocked by a sleepy seahorse curled around a branch of coral.", "{hero} asked very politely if they could pass. The seahorse yawned, uncurled its tail, and waved them through."],
            ["The Sandy X", "Finally they reached the X, but there was only sand, sand, and more sand.", "They dug with their hands and found a little chest. Inside were shells of every color, enough for every creature on the reef to have one."]
          ],
          finale: "{hero} and {friend} handed out the shells, and soon every fish, crab, and octopus was wearing a beautiful treasure. It was the happiest day the reef had ever seen." }
      ,
        { title: "the Whale Who Lost Her Hum", goal: "help Willa the whale find her humming song",
          problem: "Willa the young whale usually hummed a deep, cozy song that helped little fish sleep. Today her hum was gone. Only silence bubbles rose from her mouth.",
          steps: [
            ["Remembering the Tune", "Maybe the song was only hiding.", "{hero} hummed soft notes underwater. Willa tried to copy, but the notes came out sideways and silly."],
            ["Collecting Sounds", "The ocean is full of music if you listen.", "They gathered a shell's whisper, a wave's clap, and a dolphin's click, and practiced mixing them gently."],
            ["A Brave Soft Start", "Willa worried a wrong note would upset the reef.", "'Soft is okay,' said {friend}. Willa hummed one tiny note... then another... until her warm old song rolled out again."]
          ],
          finale: "All across the reef, little fish tucked in to Willa's hum. The sea rocked like a cradle, and everyone felt safe." },
        { title: "the Shell That Felt Too Tight", goal: "help Herm the hermit crab find a better shell",
          problem: "Herm the hermit crab wiggled and huffed. 'My shell is too tight!' he squeaked. 'I can hardly hide my claws.'",
          steps: [
            ["Shell Shopping", "Empty shells dotted the sand like tiny shops.", "They tried a spiral one (too spinny), a wide one (too wobbly), and a smooth blue one that almost fit."],
            ["A Polite Trade", "The perfect speckled shell was already admired by a shy snail.", "Herm offered his old shell plus a shiny pebble. The snail was delighted, and Herm tried the speckled home."],
            ["A Comfort Test", "Would it still feel good after a walk?", "Herm scuttled up a rock and down again. Room for claws, room for a snack crumb — perfect."]
          ],
          finale: "Herm danced a sideways dance. A good home, {hero} decided, is one you can grow into with room for kindness." },
        { title: "the Coral Garden Weeds", goal: "clear the gentle sea-weeds choking the coral garden",
          problem: "The coral garden looked pale. Soft sea-weeds had grown too thick and were hogging the sunlight the coral needed.",
          steps: [
            ["Careful Pulling", "Yanking hard could hurt the coral.", "{hero} and {friend} teased the weeds loose slowly, like untangling hair."],
            ["Where to Put Them", "Piles of weeds drifted and tangled again.", "A helpful dugong munched many of them, and the rest were tucked into a sand hollow far away."],
            ["Sunshine Returns", "Light began to filter down in golden ribbons.", "The coral brightened pink and peach. Tiny fish returned to play hide-and-seek among the branches."]
          ],
          finale: "The garden sparkled again. {hero} promised to visit each week for a gentle tidy — the kind that helps living things breathe." },
        { title: "the Tide Pool Mix-Up", goal: "help tide-pool creatures get back to the right pools",
          problem: "After a big wave, the tide pools were all mixed up. A starfish sat in a fish-only pool, and a tiny crab was stuck in a pool too deep for climbing out.",
          steps: [
            ["Matching Homes", "Each creature needed the water depth it liked.", "{friend} remembered who lived where. They made a careful list in the wet sand with a stick."],
            ["Gentle Carries", "Hands can feel huge to small creatures.", "{hero} scooped with water in a shell-cup so nobody dried out, moving one friend at a time."],
            ["A Last Check", "One anemone still looked sulky.", "It had been placed right-side up but in the shade. They shifted it to a sunny ledge, and its tentacles unfurled happily."]
          ],
          finale: "When the next tide came in, every pool hummed with the right neighbors. Mix-ups, {hero} learned, can be fixed with patience." }],
      endings: ["{hero} swam back up to the shore and lay on the warm sand, listening to the waves whisper, 'Thank you, thank you.'",
                "As {hero} waved goodbye, a hundred bubbles rose up like little balloons, carrying a hundred tiny thank-yous."],
      mood: { calm: ["The water rocked them gently, back and forth, like a slow, soft hammock."],
              funny: ["A pufferfish puffed up in surprise and bounced off {friend} like a beach ball. Boing!"],
              brave: ["The deep water looked dark, but {hero} held the seashell necklace tight and swam on."] }
    },

    dinosaurs: {
      label: "Dinosaurs", emoji: "🦕", time: ["morning", "sunny morning", "afternoon"],
      setup: ["Behind {hero}'s house was a secret path that led, believe it or not, to a valley where friendly dinosaurs still lived."],
      places: [
        ["a sunny little town called Fossil Creek", "where kids found old dinosaur bones in their gardens"],
        ["the edge of Fern Valley", "where the ferns grew as tall as houses"],
        ["a farmhouse near Rumble Rock", "where the ground sometimes went thump, thump, thump"]
      ],
      friends: [
        ["Tops", "baby triceratops", "who loved to bump things gently with three little horns"],
        ["Rexy", "small, friendly T. rex", "with tiny arms and a giant laugh"],
        ["Petal", "long-necked baby dinosaur", "who could see over all the treetops"]
      ],
      quests: [
        { title: "the Speckled Egg", goal: "return the egg to its family",
          problem: "In the middle of the path sat a big speckled egg, all alone. 'Oh my,' said {hero}. 'Someone must be missing this egg!'",
          steps: [
            ["Whose Egg?", "They asked the stegosaurus family, but their eggs were all safe and sound.", "Mama Stegosaurus pointed her spiky tail toward the river. 'Try the duck-billed dinosaurs,' she said kindly."],
            ["The Wide River", "But the river was too wide and too deep to cross.", "{friend} called to a big, friendly long-neck dinosaur, who lowered its neck like a bridge. They walked across very carefully, holding the egg tight."],
            ["The Empty Nest", "On the other side, they found a nest with one empty spot, and a worried mama dinosaur looking everywhere.", "{hero} gently placed the egg back into the nest. Just then, it began to wiggle... and crack... and out popped a baby dinosaur!"]
          ],
          finale: "The baby dinosaur gave a tiny squeak and snuggled up to its mama. The mama dinosaur nuzzled {hero} with her big, soft nose to say thank you." },
        { title: "the Great Dino Race", goal: "get ready for the Great Dino Race",
          problem: "The Great Dino Race was coming! But {friend} looked nervous. 'I'm the smallest one,' {friend} said. 'I'll never keep up.'",
          steps: [
            ["Practice Time", "At practice, {friend} tripped over a log and landed in the mud. Splat!", "{hero} helped {friend} up. 'Everyone falls sometimes,' {hero} said. 'Let's try again.' And they did, again and again."],
            ["A Special Trick", "The big dinosaurs had long legs and took giant steps. {friend} couldn't keep up.", "'But you're small enough to zip under branches and around rocks,' said {hero}. 'That's your special trick!'"],
            ["Race Day", "On race day, everyone lined up. Ready, set, go! The big dinosaurs thundered ahead.", "But the path went through a tunnel of low branches. The big dinosaurs had to slow down, and {friend} zipped right through! {friend} didn't come first, but came third, grinning from ear to ear."]
          ],
          finale: "{friend} got a shiny medal made from a polished river stone. 'I didn't win,' {friend} said, 'but I did my very best, and that feels wonderful.'" },
        { title: "the Lost Roar", goal: "help Rory find his roar",
          problem: "A young T. rex named Rory woke up and opened his mouth to roar, but all that came out was a tiny squeak. Squeak!",
          steps: [
            ["Honey and Lemon", "First they thought Rory might have a sore throat.", "Grandma Ankylosaurus brought a big leaf full of honey and lemon. Rory sipped it all up, but still, only a squeak."],
            ["Big Breaths", "Then {hero} wondered if Rory was just feeling a little shy.", "'Let's practice big breaths,' said {hero}. They all breathed in deep and let out silly sounds together. Whoosh! Honk! Boom!"],
            ["The Happy Roar", "Rory tried once more, but he was worried that a big roar might scare everyone.", "'We won't be scared,' said {hero}. 'We'll roar with you!' They all roared together, and out came Rory's roar, big and loud and full of happiness. ROAAAR!"]
          ],
          finale: "Rory roared, and then he laughed, and everyone laughed too. From that day on, Rory's roar was the friendliest sound in the whole valley." }
      ,
        { title: "the Sticky Mud Picnic", goal: "free the picnic blanket from sticky mud",
          problem: "The dinosaurs' picnic blanket had sunk into a sticky mud patch. Sandwiches were safe on a rock, but nobody could tug the blanket free without slipping.",
          steps: [
            ["No Yanking", "Pulling harder made louder squelches and bigger messes.", "{hero} said, 'Let's think before we tug.' Everyone paused, muddy but listening."],
            ["A Leaf Path", "They needed firmer ground to stand on.", "{friend} and Petal laid broad fern leaves in a walkway around the mud so feet wouldn't sink."],
            ["Team Lift", "From solid ground they lifted together on a count of three.", "The blanket came free with a funny thwop! They rinsed it in the stream and spread it on warm stones to dry."]
          ],
          finale: "The picnic happened a little late and a little damp, but the laughter was extra big. Sticky problems, it turned out, love teamwork." },
        { title: "the Missing Leaf Lunch", goal: "find the stolen-looking leaf lunch that wasn't stolen",
          problem: "The long-necks' leaf lunch pile had vanished from the feeding rock. 'Who took our lunch?' cried a worried dinosaur. Tempers flared like tiny volcanoes — but nobody had seen a thief.",
          steps: [
            ["Looking for Clues", "Broken twigs led toward the fern wall.", "They found leaf crumbs and a trail of happy footprints — small ones."],
            ["A Misunderstanding", "Behind the ferns, baby dinosaurs were playing 'restaurant.'", "They hadn't meant to steal. They thought the leaves were leftovers for pretend cooking."],
            ["Sharing for Real", "The grown-ups still needed lunch, and the babies felt sorry.", "{hero} helped everyone gather fresh leaves together and set a second pile just for restaurant games."]
          ],
          finale: "Belly-full dinosaurs napped in the sun. The babies promised to ask before borrowing lunch again — and they did." },
        { title: "the Itchy Horn Rub", goal: "help Tops soothe an itchy horn tip",
          problem: "Tops the baby triceratops kept rubbing an itchy horn tip on trees until bark stuck to it. 'It tickles and itches!' Tops sniffed.",
          steps: [
            ["A Soft Look", "Something small might be stuck.", "{hero} peered gently and found a dried bit of sap and a leaf crumb clinging to the horn."],
            ["Warm Water Wipe", "Picking at it would hurt.", "They warmed a little stream water in a smooth stone bowl and wiped softly with moss until the sap loosened."],
            ["A Soothing Rub", "The itch lingered a tiny bit.", "Grandma Ankylosaurus taught a gentle clay dab that cooled the skin. Tops sighed a happy sigh."]
          ],
          finale: "Tops's horn shone clean again. Instead of scratching trees, Tops practiced the clay dab song: dab, dab, aah." },
        { title: "the Shadow on the Cliff", goal: "show that the scary cliff shadow is only a friend",
          problem: "At dusk a huge shadow stretched across Rumble Rock cliff. Smaller dinosaurs whispered that a fearsome creature had come. Hearts thumped — but nobody had actually seen teeth.",
          steps: [
            ["Brave Curiosity", "Running away would leave the worry bigger.", "{hero} took {friend}'s paw-hand and walked closer, step by careful step."],
            ["Light and Shape", "The shadow moved when the wind moved.", "A tall fern and Petal's long neck were casting the shape together! When Petal shifted, the 'monster' bowed politely."],
            ["Telling the Others", "Fear still sat in the valley.", "They invited everyone to watch the shadow-play on purpose. Soon the little ones were making bunny ears and giggling."]
          ],
          finale: "The cliff became a favorite sunset theater. What looked scary, {hero} learned, sometimes only needs a closer, kinder look." }],
      endings: ["As the sun set behind the hills, {hero} waved goodbye to the dinosaurs and skipped back along the secret path home.",
                "That night, {hero} could still hear happy dinosaur stomps far away. Thump, thump, thump. It sounded just like a lullaby."],
      mood: { calm: ["Big dragonflies drifted over the warm, still pond, and the ferns swayed slowly."],
              funny: ["A stegosaurus sneezed, and leaves flew everywhere. One landed right on {friend}'s head like a hat."],
              brave: ["The dinosaurs were very, very big, but {hero} remembered that big can also mean gentle."] }
    },

    forest: {
      label: "Magic Forest", emoji: "🍄", time: ["morning", "misty morning", "afternoon"],
      setup: ["Just past the garden gate grew a magic forest, where the flowers could whisper and the trees could hum."],
      places: [
        ["the village of Glimmerwood", "where the mushrooms glowed softly at night"],
        ["a little cottage near the Whispering Woods", "where the flowers hummed when the wind blew"],
        ["Bramblebrook", "where the brook sparkled with tiny rainbows"]
      ],
      friends: [
        ["Twinkle", "tiny fairy with dandelion-fluff wings", "who left a trail of sparkles everywhere"],
        ["Nutmeg", "talking chipmunk", "who wore an acorn cap as a hat"],
        ["Bramble", "gentle little unicorn", "with a mane the colors of a sunset"]
      ],
      quests: [
        { title: "the Faded Flowers", goal: "bring the colors back to the forest",
          problem: "Every flower in the forest had lost its color! The roses were gray, the bluebells were gray, even the sunflowers were gray.",
          steps: [
            ["The Oldest Tree", "They asked the Oldest Tree why the colors had gone.", "The tree rumbled slowly. 'The Rainbow Spring has stopped flowing. Something must be blocking it.'"],
            ["The Fallen Branch", "At the Rainbow Spring, a big fallen branch was stuck right in the middle, and the colorful water couldn't get through.", "It was too heavy for one, but {hero}, {friend}, a badger, and three rabbits all pushed together. Heave, ho! The branch rolled away."],
            ["The Rainbow Stream", "The colorful water began to trickle, but very slowly, as if it had forgotten the way.", "{hero} drew tiny paths in the soil with a stick, guiding the water to every flower, one by one."]
          ],
          finale: "Red, orange, yellow, green, blue, and purple flowed back into the forest. The flowers stretched and shimmered, and they hummed a thank-you song." },
        { title: "the Wishing Well", goal: "help the wishing well get its magic back",
          problem: "Deep in the forest was a wishing well that granted kind wishes. But today it was silent. 'I've run out of magic,' it said in a small, echoey voice.",
          steps: [
            ["A Sparkle of Kindness", "The well needed three sparkles: one of kindness, one of laughter, and one of sharing.", "First, {hero} helped a beetle that was stuck on its back. A tiny sparkle of kindness floated up into the air."],
            ["The Giggle Glen", "Next they needed laughter, but the owls of Giggle Glen were too sleepy to laugh.", "{friend} told the silliest joke in the forest, and the owls hooted with laughter. Hoo-hoo-hoo! Another sparkle!"],
            ["The Last Berries", "The last sparkle was sharing, but {hero} only had one handful of berries left.", "{hero} shared them with a hungry hedgehog anyway. The hedgehog smiled, and the third sparkle appeared, the brightest of all."]
          ],
          finale: "They gave the sparkles to the well, and it glowed with soft blue light. 'Make a wish,' it said. {hero} wished that everyone in the forest would have a happy day, and they did." },
        { title: "the Fairy Queen's Lantern", goal: "find the Fairy Queen's lantern",
          problem: "The fairies were getting ready for the Moonlight Dance, but the Fairy Queen's lantern had gone missing. Without it, the dance couldn't begin.",
          steps: [
            ["The Mushroom Ring", "They looked in the mushroom ring, but all they found were giggling ladybugs.", "The ladybugs had seen a glow floating toward the pond, and they kindly showed the way."],
            ["The Talking Frog", "At the pond, a big green frog said, 'I'll tell you where it is, if you can make me laugh.'", "{hero} made the funniest face ever, with puffed-out cheeks and wiggly eyebrows. The frog laughed so hard he fell off his lily pad. Splash!"],
            ["The Firefly Family", "The frog pointed to a hollow tree, where the lantern was glowing among a family of baby fireflies.", "The baby fireflies loved the light. So {hero} asked if they would like to come to the dance and glow along with it. The fireflies twinkled yes!"]
          ],
          finale: "The Fairy Queen clapped her tiny hands. The lantern glowed, the fireflies twinkled, and everyone danced in the moonlight, even {hero}." }
      ,
        { title: "the Acorn Cap Mystery", goal: "return Nutmeg's missing acorn cap",
          problem: "Nutmeg the chipmunk's favorite acorn cap hat had vanished. Without it, Nutmeg's ears felt breezy and his confidence felt tiny.",
          steps: [
            ["Asking the Mushrooms", "The glowing mushrooms had seen a cap-shaped shadow at dawn.", "They pointed toward the creek where laundry fairies rinsed dew-cloths."],
            ["A Mistaken Borrow", "A young fairy had borrowed the cap as a boat for a beetle who couldn't swim.", "The beetle was safely across now, but the cap was waterlogged and floppy."],
            ["Drying and Mending", "A soggy hat is a sad hat.", "{hero} set it on a sun-warm rock, and Twinkle stitched a sparkle-thread inside so it would keep its shape."]
          ],
          finale: "Nutmeg popped the cap back on and stood tall. He forgave the fairy at once — especially after she promised to ask next time." },
        { title: "the Path of Fading Sparkles", goal: "restore the sparkle path that guides lost walkers",
          problem: "The sparkle path that led wanderers safely through Glimmerwood was fading. Without it, even careful feet might wander in circles.",
          steps: [
            ["Finding the Source", "Sparkles usually flowed from the Dewdrop Lantern tree.", "The lantern's wick — a twist of moon-silk — had come loose and dangled darkly."],
            ["Rekindling Softly", "Fire was too fierce for moon-silk.", "{friend} gathered firefly volunteers who glowed gently until the silk caught a silver shine again."],
            ["Tracing the Path", "Light returned at the tree, but the path still looked patchy.", "{hero} walked the route slowly, and wherever feet stepped kindly, fresh sparkles woke up behind them."]
          ],
          finale: "By twilight the path shimmered from gate to glen. Lost walkers found their way, and the forest hummed relieved green notes." },
        { title: "the Grumpy Toadstool", goal: "cheer up a toadstool who blocked the berry trail",
          problem: "A large toadstool had plopped right in the middle of the berry trail and refused to scoot. 'I'm grumpy and I'm staying,' it muttered.",
          steps: [
            ["Why So Grumpy?", "Pushing would be rude, and also sticky.", "{hero} sat down and asked what was wrong. The toadstool admitted a deer had nearly stepped on it yesterday."],
            ["A Safer Spot", "It still needed to grow, just not in the walking lane.", "Together they found a shady nook beside the trail with soft soil and a 'Please step around' pebble sign."],
            ["Moving Day", "Toadstools hate being rushed.", "They hummed a slow digging song, loosened the soil, and eased the toadstool into its new home inch by inch."]
          ],
          finale: "The berry trail opened again. The toadstool, less grumpy already, even waved a spotted cap as hikers passed." },
        { title: "the Butterfly Who Lost Her Map Colors", goal: "help Luna-wing the butterfly remember her migration colors",
          problem: "Luna-wing the butterfly navigated by remembering color patterns on flowers. Today all the colors in her mind looked gray. 'How will I find the south meadow?' she worried.",
          steps: [
            ["Color Walk", "Maybe her eyes just needed practice.", "{hero} and {friend} walked her past red poppies, bluebells, and yellow buttercups, naming each color aloud."],
            ["A Memory Game", "Naming helped a little, but the route was still fuzzy.", "They made a tiny color-bead bracelet matching the flower order along the trail: red, blue, yellow, purple."],
            ["A Trial Flutter", "Would the bracelet work in the air?", "Luna-wing flew short hops, checking beads to blooms. At the south meadow she spun in a joyful loop."]
          ],
          finale: "Color returned to Luna-wing's memory like paint in rain. She gifted {hero} a single shimmering scale that glowed like a thank-you." }],
      endings: ["As {hero} walked home through the garden gate, the trees hummed a soft goodbye song.",
                "Before {hero} left, {friend} tucked a tiny glowing flower behind {hero}'s ear. 'So you can always find your way back,' {friend} said."],
      mood: { calm: ["The forest smelled like rain and pine, and soft green light fell through the leaves."],
              funny: ["A mushroom sneezed out a puff of glitter, and now {friend} sparkled from nose to toes."],
              brave: ["The path got darker under the tall trees, but the glowing mushrooms lit the way, one by one."] }
    }
  };

  /* ------------------------------------------------------------------ *
   *  Engine                                                             *
   * ------------------------------------------------------------------ */
  function generateStory(opts) {
    opts = opts || {};
    var seed = (opts.seed >>> 0) || (Math.floor(Math.random() * 900000) + 100000);
    var rnd = mulberry32(seed);
    var pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
    var decks = {};
    function draw(key, arr) { // pick without repeats within one story
      if (!decks[key] || decks[key].length === 0) decks[key] = arr.slice();
      var d = decks[key];
      return d.splice(Math.floor(rnd() * d.length), 1)[0];
    }

    var tier = Math.max(0, Math.min(2, opts.age | 0));
    var themeKey = THEMES[opts.theme] ? opts.theme : pick(Object.keys(THEMES));
    var theme = THEMES[themeKey];
    var mood = (opts.mood === "funny" || opts.mood === "brave") ? opts.mood : "calm";
    var medium = opts.length === "medium";
    var pron = PRONOUNS[opts.pronoun] ? opts.pronoun : "she";

    var hero = cleanName(opts.name) || pick(NAMES[pron]);
    var quest = pick(theme.quests);
    var place = pick(theme.places);
    var friends = theme.friends.filter(function (f) { return f[0].toLowerCase() !== hero.toLowerCase(); });
    var fr = pick(friends);

    var P = PRONOUNS[pron];
    var vars = {
      hero: hero, friend: fr[0], aFriend: article(fr[1]), friendTrait: fr[2],
      place: place[0], placeLook: place[1], goal: quest.goal, time: pick(theme.time),
      they: P.they, them: P.them, their: P.their, self: P.self, They: cap(P.they),
      qt: quest.title, QT: cap(quest.title)
    };

    function fill(s) {
      for (var pass = 0; pass < 3; pass++) {
        s = s.replace(/\[([^\[\]]*)\]/g, function (m, inner) { var p = inner.split("|"); return p[Math.min(tier, p.length - 1)]; });
        s = s.replace(/<([^<>]*)>/g, function (m, inner) { return pick(inner.split("|")); });
        s = s.replace(/\{(\w+)\}/g, function (m, k) { return Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m; });
      }
      return cap(s.replace(/\s+/g, " ").trim());
    }
    function para() { return fill(Array.prototype.slice.call(arguments).filter(Boolean).join(" ")); }
    function moodLine() { return draw("mood", G.mood[mood].concat(theme.mood[mood] || [])); }
    function reaction() { return rnd() < 0.5 ? draw("react", G.reaction.any) : draw("react-" + mood, G.reaction[mood]); }
    function stepPara(i, withMood, withReaction) {
      var s = quest.steps[i];
      return para(s[1], withMood ? moodLine() : "", s[2], withReaction ? reaction() : "");
    }

    var little = tier === 0; // ages 3–5: a bit shorter and simpler
    var intro1 = para(pick(G.opener), pick(G.heroTrait), pick(theme.setup));
    var intro2 = para(pick(G.friendIntro), medium ? pick(G.friendFun) : "");
    var problem = para(pick(G.timeLead), quest.problem);
    var decide = para(pick(G.decide));
    var finale = para(quest.finale, (medium || !little) ? draw("moral", G.moral) : "");
    var ending = para(rnd() < 0.5 ? pick(theme.endings) : pick(G.ending[mood]), "The End.");

    var chapters;
    if (medium) {
      chapters = [
        { title: fill(pick(G.chapter1)), paragraphs: [intro1, intro2] },
        { title: fill(pick(G.chapterProblem)), paragraphs: [problem, decide, para(pick(G.travel)), stepPara(0, true, !little)] },
        { title: quest.steps[1][0], paragraphs: [stepPara(1, true, true), para(pick(G.midpoint)), stepPara(2, true, !little)] },
        { title: fill(pick(G.chapterEnd)), paragraphs: [finale, para(pick(G.reflect)), ending] }
      ];
    } else {
      chapters = [
        { title: fill(pick(G.chapter1)), paragraphs: [intro1, intro2, problem, decide] },
        { title: quest.steps[0][0], paragraphs: [stepPara(0, true, false), stepPara(1, false, !little)] },
        { title: quest.steps[2][0], paragraphs: [stepPara(2, !little, false), finale, ending] }
      ];
    }

    var title = fill(pick(G.titles));
    var words = 0;
    chapters.forEach(function (c) { c.paragraphs.forEach(function (p) { words += p.split(/\s+/).length; }); });
    return {
      seed: seed, title: title, theme: themeKey, themeLabel: theme.label, emoji: theme.emoji,
      mood: mood, age: ["3–5", "6–8", "9–11"][tier], length: medium ? "medium" : "short",
      hero: hero, chapters: chapters, words: words,
      minutes: Math.max(1, Math.round(words / 125)) // ~125 wpm at the slightly slow default rate
    };
  }

  function cap(s) {
    return String(s).replace(/^(['"\s]*)([a-z])/, function (m, pre, ch) { return pre + ch.toUpperCase(); });
  }
  function article(w) { return (/^[aeiou]/i.test(w) ? "an " : "a ") + w; }
  function cleanName(n) {
    if (!n) return "";
    n = String(n).replace(/[^\p{L}\p{M}' \-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 24);
    return n ? n.charAt(0).toUpperCase() + n.slice(1) : "";
  }
  function storyToText(story) {
    var out = [story.title, "", cap(article(story.themeLabel)) + " story · ages " + story.age + " · story no. " + story.seed, ""];
    story.chapters.forEach(function (c, i) {
      out.push("Chapter " + (i + 1) + ": " + c.title, "");
      c.paragraphs.forEach(function (p) { out.push(p, ""); });
    });
    out.push("Made with Snuggle Stories.");
    return out.join("\n");
  }

  var Engine = { generateStory: generateStory, storyToText: storyToText, THEMES: THEMES };
  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  root.SnuggleEngine = Engine;

  /* ------------------------------------------------------------------ *
   *  Browser UI                                                         *
   * ------------------------------------------------------------------ */
  if (typeof document === "undefined") return;

  var $ = function (s) { return document.querySelector(s); };
  var current = null;     // current story object
  var segments = [];      // [{el, items:[chunk]}] one per title/heading/paragraph
  var queue = [];         // flat list of {seg, span, say, gap}
  var pos = 0;            // index of the chunk being (or about to be) read
  var state = "idle";     // idle | playing | paused
  var runId = 0;          // invalidates callbacks from cancelled utterances
  var synth = window.speechSynthesis;
  var voices = [];
  var prefs = loadPrefs();

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem("snuggle-prefs")) || {}; } catch (e) { return {}; }
  }
  function savePrefs() {
    try { localStorage.setItem("snuggle-prefs", JSON.stringify(prefs)); } catch (e) { /* storage blocked: fine */ }
  }
  function radio(name) { var el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; }
  function setRadio(name, val) {
    if (val === undefined || val === null) return;
    var el = document.querySelector('input[name="' + name + '"][value="' + String(val).replace(/"/g, "") + '"]');
    if (el) el.checked = true;
  }

  /* ---------------- Free vs. "Unlock all worlds" ---------------- */
  var FREE_THEMES = ["bedtime", "animals"];   // always free, unlimited stories
  var FREE_LENGTHS = ["short"];               // "Longer" stories are part of the unlock
  var U = window.unlock || { isUnlocked: function () { return false; }, mode: function () { return "web"; },
    onChange: function () {}, buy: function () { return Promise.resolve({ ok: false, web: true }); },
    restore: function () { return Promise.resolve({ ok: false, web: true }); }, price: function () { return "$4.99"; },
    isDevUnlock: function () { return false; } };
  function isThemeFree(k) { return U.isUnlocked() || FREE_THEMES.indexOf(k) >= 0; }
  function isLengthFree(v) { return U.isUnlocked() || FREE_LENGTHS.indexOf(v) >= 0; }

  function buildThemeGrid() {
    var grid = $("#theme-grid");
    Object.keys(THEMES).forEach(function (k, i) {
      var t = THEMES[k];
      var label = document.createElement("label");
      label.className = "theme-card theme-" + k;
      label.setAttribute("data-theme", k);
      label.innerHTML = '<input type="radio" name="theme" value="' + k + '"' + (i === 0 ? " checked" : "") + ">" +
        '<span class="theme-emoji" aria-hidden="true">' + t.emoji + '</span><span class="theme-name">' + t.label + "</span>" +
        '<span class="lock-badge" aria-hidden="true">🔒</span><span class="free-badge">Free</span>';
      label.addEventListener("click", function (e) {
        if (isThemeFree(k)) return;
        e.preventDefault();
        openUpsell({ theme: k });
      });
      grid.appendChild(label);
    });
  }

  function applyLocks() {
    var on = U.isUnlocked();
    document.documentElement.classList.toggle("is-unlocked", on);
    Array.prototype.forEach.call(document.querySelectorAll(".theme-card"), function (card) {
      var k = card.getAttribute("data-theme"), locked = !isThemeFree(k);
      card.classList.toggle("locked", locked);
      card.classList.toggle("is-free", !on && FREE_THEMES.indexOf(k) >= 0);
      var input = card.querySelector("input");
      input.setAttribute("aria-label", THEMES[k].label + (locked ? " (part of the full version)" : ""));
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="length"]'), function (input) {
      var chip = input.closest(".chip"), locked = !isLengthFree(input.value);
      chip.classList.toggle("locked", locked);
    });
    if (!isThemeFree(radio("theme"))) setRadio("theme", FREE_THEMES[0]);
    if (!isLengthFree(radio("length"))) setRadio("length", FREE_LENGTHS[0]);
    var gp = $("#grownups-status");
    if (gp) gp.textContent = on ? (U.isDevUnlock() ? "🛠️ Developer preview: everything is unlocked on this device (?devunlock=0 to lock again)."
      : "🎉 Everything is unlocked. Thank you for supporting Snuggle Stories!") : "";
    var ub = $("#unlock-open"); if (ub) ub.hidden = on;
  }

  /* Upsell (kid-facing, calm) -> parent gate -> buy / restore / store info */
  var lastFocus = null;
  function showModal(id) {
    Array.prototype.forEach.call(document.querySelectorAll(".modal"), function (m) { m.hidden = m.id !== id; });
    var back = $("#modal-backdrop");
    if (back.hidden) lastFocus = document.activeElement;
    back.hidden = false;
    document.body.classList.add("modal-open");
    var m = $("#" + id), f = m.querySelector("[data-autofocus]") || m.querySelector("button, input");
    if (f) setTimeout(function () { f.focus(); }, 30);
  }
  function closeModal() {
    $("#modal-backdrop").hidden = true;
    document.body.classList.remove("modal-open");
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
    lastFocus = null;
  }

  function openUpsell(ctx) {
    ctx = ctx || {};
    var t = ctx.theme && THEMES[ctx.theme];
    $("#upsell-emoji").textContent = t ? t.emoji : "✨";
    $("#upsell-title").textContent = t ? ("The " + t.label + " world is waiting!") : ctx.length ? "Longer stories are waiting!"
      : ctx.feature === "record" ? "Read stories in your own voice!" : ctx.feature === "voice" ? "Hear stories in your grown-up's voice!" : "Unlock all the worlds!";
    if (ctx.feature) $("#upsell-emoji").textContent = "🎙️";
    $("#upsell-price").textContent = U.price();
    $("#upsell-msg").textContent = "";
    showModal("upsell");
  }

  /* Parent gate: type a spelled-out number as digits. Can't be passed by tapping around. */
  var ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  var TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  function spell(n) { return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : ""); }
  var gate = { answer: 0, then: null, tries: 0 };
  function newGateNumber() {
    var n; do { n = 21 + Math.floor(Math.random() * 79); } while (n % 10 === 0 || n === gate.answer);
    gate.answer = n;
    $("#gate-words").textContent = spell(n);
    $("#gate-input").value = "";
    $("#gate-msg").textContent = "";
  }
  function parentGate(purpose, then) {
    gate.then = then; gate.tries = 0;
    $("#gate-purpose").textContent = purpose;
    newGateNumber();
    showModal("gate");
  }
  function submitGate(e) {
    if (e) e.preventDefault();
    var v = $("#gate-input").value.replace(/\s+/g, "");
    if (/^\d{1,3}$/.test(v) && +v === gate.answer) {
      var then = gate.then; gate.then = null;
      if (then) then(); else closeModal();
      return;
    }
    gate.tries++;
    if (gate.tries >= 3) { newGateNumber(); gate.tries = 0; $("#gate-msg").textContent = "Let's try a new number."; }
    else { $("#gate-input").value = ""; $("#gate-msg").textContent = "Not quite. Please type the number using digits, like 47."; }
    $("#gate-input").focus();
  }

  function showInfo(emoji, title, body) {
    $("#info-emoji").textContent = emoji;
    $("#info-title").textContent = title;
    $("#info-body").textContent = body;
    showModal("info");
  }
  function webInfo() {
    showInfo("📱", "The full version lives in the apps",
      "This web version includes the Bedtime and Animals worlds for free, with as many stories as you like. " +
      "To unlock every world and longer stories, get Snuggle Stories from the App Store or Google Play and choose " +
      "\"Unlock all worlds\" there (" + U.price() + ", one time, no subscription, no ads).");
  }
  function doBuy() {
    if (U.mode() !== "native") { webInfo(); return; }
    showInfo("⏳", "Opening the store…", "Follow the steps from the App Store or Google Play.");
    U.buy().then(function (r) {
      if (r.ok) { applyLocks(); showInfo("🎉", "All worlds unlocked!", "Thank you! Every world and longer stories are ready. Sweet dreams!"); }
      else if (r.web) webInfo();
      else if (r.cancelled) closeModal();
      else showInfo("😕", "That didn't go through", r.message || "Please try again later. You were not charged.");
    });
  }
  function doRestore() {
    if (U.mode() !== "native") {
      showInfo("📱", "Restore in the app", "Purchases are restored inside the App Store or Google Play version of Snuggle Stories. The web version has nothing to restore.");
      return;
    }
    showInfo("⏳", "Checking your purchases…", "This takes a moment.");
    U.restore().then(function (r) {
      applyLocks();
      if (U.isUnlocked()) showInfo("🎉", "Purchase restored!", "Every world and longer stories are unlocked again.");
      else showInfo("🔎", "No purchase found", r.message || "We couldn't find \"Unlock all worlds\" on this store account. Make sure you're signed in with the account that bought it.");
    });
  }

  function initUnlock() {
    applyLocks();
    U.onChange(applyLocks);
    Array.prototype.forEach.call(document.querySelectorAll('input[name="length"]'), function (input) {
      input.closest(".chip").addEventListener("click", function (e) {
        if (isLengthFree(input.value)) return;
        e.preventDefault();
        openUpsell({ length: input.value });
      });
    });
    $("#upsell-ask").addEventListener("click", function () {
      parentGate("Unlock all worlds for " + U.price(), doBuy);
    });
    $("#upsell-restore").addEventListener("click", function () { parentGate("Restore a purchase", doRestore); });
    $("#grownups-btn").addEventListener("click", function () {
      parentGate("Grown-up settings", function () { applyLocks(); showModal("grownups"); });
    });
    $("#unlock-open").addEventListener("click", function () { openUpsell({}); });
    $("#gp-buy").addEventListener("click", doBuy);
    $("#gp-restore").addEventListener("click", doRestore);
    $("#gate-form").addEventListener("submit", submitGate);
    $("#gate-new").addEventListener("click", newGateNumber);
    Array.prototype.forEach.call(document.querySelectorAll("[data-close]"), function (b) { b.addEventListener("click", closeModal); });
    $("#modal-backdrop").addEventListener("click", function (e) { if (e.target === this) closeModal(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("#modal-backdrop").hidden) closeModal(); });
  }

  function makeStory(surprise) {
    if (surprise) {
      var keys = Object.keys(THEMES).filter(isThemeFree);
      setRadio("theme", keys[Math.floor(Math.random() * keys.length)]);
      setRadio("mood", ["calm", "funny", "brave"][Math.floor(Math.random() * 3)]);
    }
    stopSpeech();
    var opts = {
      name: $("#child-name").value, pronoun: radio("pronoun"), age: +radio("age"),
      theme: radio("theme"), mood: radio("mood"), length: radio("length")
    };
    if (!isThemeFree(opts.theme)) opts.theme = FREE_THEMES[0];   // never generate locked content
    if (!isLengthFree(opts.length)) opts.length = FREE_LENGTHS[0];
    prefs.form = opts; savePrefs();
    current = generateStory(opts);
    renderStory(current);
  }

  function renderStory(story) {
    var book = $("#story");
    book.innerHTML = "";
    segments = [];
    var head = document.createElement("div"); head.className = "story-head";
    var emoji = document.createElement("div"); emoji.className = "story-emoji"; emoji.setAttribute("aria-hidden", "true"); emoji.textContent = story.emoji;
    var h = document.createElement("h2"); h.className = "story-title speakable"; h.textContent = story.title;
    var meta = document.createElement("p"); meta.className = "story-meta";
    meta.textContent = story.themeLabel + " · " + cap(story.mood) + " · ages " + story.age + " · about " + story.minutes + " min · story no. " + story.seed;
    head.appendChild(emoji); head.appendChild(h); head.appendChild(meta);
    book.appendChild(head);
    addSegment(h, story.title + ".", "title", GAP.title);
    story.chapters.forEach(function (c, i) {
      var sec = document.createElement("section"); sec.className = "chapter";
      var ch = document.createElement("h3"); ch.className = "speakable";
      ch.textContent = "Chapter " + (i + 1) + ": " + c.title;
      sec.appendChild(ch);
      addSegment(ch, "Chapter " + (i + 1) + ". " + c.title + ".", "heading", GAP.heading);
      c.paragraphs.forEach(function (p) {
        var el = document.createElement("p"); el.className = "speakable";
        sec.appendChild(el); addSegment(el, p, "para", GAP.paragraph);
      });
      book.appendChild(sec);
    });
    queue = [];
    segments.forEach(function (s) { s.items.forEach(function (it) { queue.push(it); }); });
    pos = 0;
    $("#listen").hidden = false;
    $("#empty-state").hidden = true;
    updateButtons();
    $("#listen").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------------- Text → spoken chunks ----------------
     Every paragraph is split into sentence-sized chunks (long sentences at commas) and queued one by
     one. Short utterances dodge Chrome's ~15 s cut-off and iOS stalls, give natural pauses, and let
     the follow-along highlight track the exact sentence being read. */
  var ABBR = /\b(Mr|Mrs|Ms|Dr|St|Mt|Jr|Sr|Prof|Capt|vs|etc)\.$/i;
  var GAP = { comma: 60, sentence: 170, ellipsis: 420, paragraph: 650, heading: 850, title: 1000 };

  function splitDisplay(text) {
    // Returns [{text, pause}] whose .text pieces join back to exactly `text` (so spans can wrap them).
    var out = [], start = 0, m, re = /(\.{3,}|…|[.!?]+)(['"’”)\]]*)(\s+|$)/g;
    while ((m = re.exec(text))) {
      var end = m.index + m[0].length;
      if (m[1] === "." && ABBR.test(text.slice(start, m.index + 1))) continue;     // "Mr. Bramble" is one sentence
      if (end === m.index) { re.lastIndex++; continue; }
      out.push({ text: text.slice(start, end), pause: /\.\.|…/.test(m[1]) ? GAP.ellipsis : GAP.sentence });
      start = end;
      if (end >= text.length) break;
    }
    if (start < text.length) out.push({ text: text.slice(start), pause: GAP.sentence });
    var res = [];
    out.forEach(function (piece) {                      // very long sentence → split at , ; : or dashes
      if (piece.text.length <= 130) { res.push(piece); return; }
      var parts = piece.text.split(/(?<=[,;:—–])\s+/), buf = "";
      parts.forEach(function (p, i) {
        buf += (buf ? " " : "") + p;
        var restLen = parts.slice(i + 1).join(" ").length;
        if (i < parts.length - 1 && buf.length >= 40 && restLen >= 25) { res.push({ text: buf + " ", pause: GAP.comma }); buf = ""; }
      });
      if (buf) res.push({ text: buf, pause: piece.pause });
    });
    return res.filter(function (p) { return p.text.trim(); });
  }

  // Clean text so the voice reads words only: no emoji names ("crescent moon"), symbols or markup.
  function speakable(s) {
    s = String(s)
      .replace(/<[^>]*>/g, " ")
      .replace(/[\p{Extended_Pictographic}\p{So}\u{FE0F}\u{FE0E}\u{200D}\u{20E3}\u{1F1E6}-\u{1F1FF}]/gu, " ")
      .replace(/&/g, " and ")
      .replace(/\s*[—–]\s*/g, ", ")                    // dashes → a short breath
      .replace(/\s*(\.{2,}|…)\s*/g, ", ")               // ellipses → pause (and never "dot dot dot")
      .replace(/[“”"«»*_~#<>\[\]{}|^`\\=+@·•]/g, " ")
      .replace(/\//g, " ")
      .replace(/\s+/g, " ")
      .replace(/(^|\s)['‘’](?=\s|$)/g, " ")             // stray quote marks
      .replace(/^[\s,'‘’]+/, "")                        // leading "...ello" / commas
      .replace(/\s+([,.!?;:])/g, "$1")
      .replace(/,\s*([.!?])/g, "$1")
      .replace(/([,;:])(\s*[,;:])+/g, "$1")
      .trim();
    s = s.replace(/[,;:]+(['’]?)$/, ".$1");             // ends on a pause → finish as a sentence
    return /[\p{L}\p{N}]/u.test(s) ? s : "";
  }

  function addSegment(el, text, kind, gapAfter) {
    // kind "para": wrap each sentence in a span for sentence-level highlighting.
    var si = segments.length, seg = { el: el, items: [], kind: kind };
    segments.push(seg);
    if (kind === "para") {
      el.textContent = "";
      var pieces = splitDisplay(text);
      pieces.forEach(function (p, k) {
        var span = document.createElement("span"); span.className = "sent"; span.textContent = p.text;
        el.appendChild(span);
        var say = speakable(p.text);
        if (say) seg.items.push({ seg: si, span: span, say: say, gap: k === pieces.length - 1 ? gapAfter : p.pause });
      });
    } else {
      var say = speakable(text);
      if (say) seg.items.push({ seg: si, span: null, say: say, gap: gapAfter });
    }
    el.addEventListener("click", function (e) { // tap a paragraph (or sentence) to read from there
      if (!synth) return;
      var idx = -1, sp = e.target && e.target.closest ? e.target.closest(".sent") : null;
      for (var i = 0; i < queue.length; i++) {
        if (sp ? queue[i].span === sp : queue[i].seg === si) { idx = i; break; }
      }
      if (idx >= 0) speakFrom(idx);
    });
  }

  /* ---------------- Voices: rank for naturalness, hide novelty/robotic ones ---------------- */
  var UA = navigator.userAgent || "";
  var IS_IOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var IS_ANDROID = /Android/i.test(UA);
  var IS_MAC = !IS_IOS && /Macintosh/.test(UA);
  var IS_WIN = /Windows/.test(UA);
  var IS_APPLE_WEBKIT = (IS_IOS || IS_MAC) && /AppleWebKit/.test(UA) && !/Chrome|Chromium|Edg|Firefox|FxiOS|CriOS/.test(UA) || IS_IOS;
  var IS_NATIVE = document.documentElement.classList.contains("native-app");
  var IS_MOBILE = IS_IOS || IS_ANDROID;

  var NOVELTY_NAMES = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|junior|organ|superstar|trinoids|whisper|wobble|zarvox|fred|ralph|kathy|jester|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley|espeak|mbrola)\b/i;
  var NOVELTY_URIS = /espeak|mbrola|novelty|eloquence|speech\.synthesis\.voice\.(albert|bahh|bells|boing|bubbles|cellos|deranged|fred|hysterical|junior|organ|princess|ralph|kathy|trinoids|whisper|zarvox|badnews|goodnews|pipeorgan|bad|good)/i;
  var GOOD_APPLE = /\b(samantha|ava|allison|susan|karen|daniel|moira|tessa|serena|kate|zoe|zoë|evan|nicky|joelle|nathan|noelle|tom|fiona|rishi|veena|lee|matilda|catherine|gordon|arthur|martha|aaron|nora|stephanie|oliver)\b/i;
  var badVoices = {};   // voices that errored (e.g. online voice while offline) → skip for this session

  function voiceKey(v) { return v.voiceURI || v.name; }
  function isNovelty(v) { return NOVELTY_NAMES.test(v.name || "") || NOVELTY_URIS.test(v.voiceURI || ""); }

  // Quality only (0–60). >= 40 counts as "natural sounding".
  function voiceQuality(v) {
    if (v.personal) return 70;                                 // the grown-up's own Apple Personal Voice
    var n = (v.name || "") + " " + (v.voiceURI || "");
    if (/premium/i.test(n)) return 60;
    if (/natural|neural|wavenet|studio|journey/i.test(n)) return 58;
    if (/siri/i.test(n)) return 55;
    if (/enhanced/i.test(n)) return 50;
    if (/google (us|uk) english/i.test(n)) return 45;
    if (/microsoft .*online/i.test(n)) return 45;
    if (/-x-[a-z]{3}-network/i.test(n)) return 42;           // Android Google TTS (online)
    if (/-x-[a-z]{3}-local|-language$/i.test(n)) return 40;  // Android Google TTS (on-device, decent)
    if (IS_ANDROID && /^english\b/i.test(v.name || "")) return 40; // Chrome on Android (Google TTS)
    if (/^google\b/i.test(v.name || "")) return 34;
    if (GOOD_APPLE.test(v.name || "")) return 25;              // Apple "compact" voices: OK, a bit flat
    if (/microsoft/i.test(n)) return 15;                       // Zira/David/Hazel desktop voices
    return 8;
  }
  function scoreVoice(v) {
    var s = voiceQuality(v), lang = String(v.lang || "").replace("_", "-").toLowerCase();
    var want = String(navigator.language || "en-US").toLowerCase();
    if (lang === want) s += 6; else if (lang === "en-us" || lang === "en-gb") s += 3; else if (/^en/.test(lang)) s += 1;
    if (v.localService !== false) s += 2;      // works offline and avoids network hiccups
    if (v["default"]) s += 2;
    if (/samantha|ava|zoe|allison|aria|jenny|sonia|libby/i.test(v.name || "")) s += 1; // warm storyteller voices
    return s;
  }

  function loadVoices() {
    if (!synth) return;
    var all = synth.getVoices() || [];
    if (!all.length) return;
    var personal = all.filter(function (v) { return v.personal; });
    all = all.filter(function (v) { return !v.personal; });
    var en = all.filter(function (v) { return /^en/i.test(v.lang || ""); });
    var pool = (en.length ? en : all).filter(function (v) { return !isNovelty(v); });
    if (!pool.length) pool = en.length ? en : all;
    if (U.isUnlocked()) pool = personal.concat(pool);           // Personal Voice is part of the full version
    voices = pool.slice().sort(function (a, b) { return scoreVoice(b) - scoreVoice(a) || (a.name || "").localeCompare(b.name || ""); });
    var sel = $("#voice");
    sel.innerHTML = "";
    var groups = [["✨ Most natural", voices.filter(function (v) { return voiceQuality(v) >= 40; })],
                  ["Other voices", voices.filter(function (v) { return voiceQuality(v) < 40; })]];
    groups.forEach(function (g) {
      if (!g[1].length) return;
      var parent = sel;
      if (groups[0][1].length && groups[1][1].length) { parent = document.createElement("optgroup"); parent.label = g[0]; sel.appendChild(parent); }
      g[1].forEach(function (v) {
        var o = document.createElement("option");
        o.value = voiceKey(v);
        o.textContent = (v === voices[0] ? "⭐ " : "") + voiceLabel(v);
        parent.appendChild(o);
      });
    });
    // A grown-up's explicit choice wins; otherwise always the best-ranked voice (re-ranked as voices arrive).
    var pick = prefs.voice && voices.some(function (v) { return voiceKey(v) === prefs.voice; }) ? prefs.voice : voiceKey(voices[0]);
    sel.value = pick;
    $("#voice-field").hidden = voices.length < 2;
    updateVoiceTip();
  }

  function voiceLabel(v) {
    var name = String(v.name || "Voice").replace(/^Microsoft\s+/, "").replace(/\s*-\s*English.*$/, "");
    var uri = v.voiceURI || "", m = uri.match(/-x-([a-z]{3})-(local|network)/i);
    if (m) name += " · voice " + m[1].toUpperCase() + (m[2] === "network" ? " (online)" : "");
    if (/premium/i.test(uri) && !/premium/i.test(name)) name += " (Premium)";
    else if (/enhanced/i.test(uri) && !/enhanced/i.test(name)) name += " (Enhanced)";
    if (name.indexOf("(") < 0 || m) name += " · " + v.lang;
    return name;
  }

  function selectedVoice() {
    var val = $("#voice").value;
    var v = voices.filter(function (x) { return voiceKey(x) === val; })[0];
    if (v && !badVoices[voiceKey(v)]) return v;
    return voices.filter(function (x) { return !badVoices[voiceKey(x)]; })[0] || null;
  }

  // Grown-up tip when this device only has basic (robotic-sounding) voices.
  function voiceHelpText() {
    if (IS_IOS) return "On iPhone or iPad: open Settings › Accessibility › Spoken Content › Voices › English, download an “Enhanced” or “Premium” voice (Ava, Zoe or Evan sound lovely), then reopen Snuggle Stories and pick it here. No sound? Check the silent switch and volume.";
    if (IS_MAC) return "On a Mac: System Settings › Accessibility › Spoken Content › System voice › Manage Voices…, download an “Enhanced” or “Premium” English voice (e.g. Ava or Zoe), then reload this page and pick it here.";
    if (IS_ANDROID) return "On Android: open Settings, search “Text-to-speech”, choose “Speech Services by Google”, then Install voice data › English and download a voice. Reopen Snuggle Stories and pick it here.";
    if (IS_WIN) return "On Windows: open this page in Microsoft Edge for its very natural “Online (Natural)” voices, or in Chrome for the Google voices.";
    return "For a more natural voice, try Microsoft Edge or Google Chrome, which include nicer built-in voices.";
  }
  function updateVoiceTip() {
    var best = voices[0], basic = !best || voiceQuality(best) < 40;
    var tip = $("#voice-tip"), help = $("#voice-help");
    if (help) $("#voice-help-text").textContent = voiceHelpText();
    if (tip) {
      $("#voice-tip-text").textContent = voiceHelpText();
      tip.hidden = !(basic && voices.length) || !!prefs.voiceTipClosed;
    }
  }

  /* ---------------- Apple Personal Voice (iPhone app only, full version) ---------------- */
  var PVS = window.SnugglePersonalVoice || { available: false };
  function pvMessage(r) {
    if (!r) return "";
    if (r.status === "authorized" && r.count) return "💛 Your Personal Voice is ready. Pick “My Personal Voice” in the Voice list above.";
    if (r.status === "authorized") return "Allowed, but no Personal Voice was found. Create one in Settings › Accessibility › Personal Voice, then come back.";
    if (r.status === "denied") return "Not allowed yet. In Settings › Accessibility › Personal Voice, turn on “Allow Apps to Request to Use”, then try again.";
    if (r.status === "unsupported") return "Personal Voice needs an iPhone or iPad with iOS 17 or later.";
    return "";
  }
  function initPersonalVoice() {
    var box = $("#pv-box"); if (!box) return;
    box.hidden = !PVS.available;
    if (!PVS.available) return;
    $("#pv-btn").addEventListener("click", function () {
      if (!U.isUnlocked()) { openUpsell({ feature: "voice" }); return; }
      parentGate("Use my Personal Voice", function () {
        closeModal();
        $("#pv-msg").textContent = "Asking your iPhone…";
        PVS.request().then(function (r) { $("#pv-msg").textContent = pvMessage(r); loadVoices(); });
      });
    });
  }

  /* ---------------- Rate / pitch ---------------- */
  function clamp(x, lo, hi) { x = +x; if (!isFinite(x)) x = 1; return Math.min(hi, Math.max(lo, x)); }
  // WebKit on iPhone/iPad/Mac maps rate < 1 linearly onto Apple's speech scale, which sounds too slow at the low end,
  // and rate > 1 jumps quickly. Soften both ends so the slider feels the same as Chrome. (Native app: see native-shim.js.)
  function effectiveRate(r) {
    r = clamp(r, 0.5, 1.5);
    if (IS_APPLE_WEBKIT && !IS_NATIVE) r = r < 1 ? 1 - (1 - r) * 0.8 : 1 + (r - 1) * 0.8;
    return Math.round(r * 100) / 100;
  }
  function effectivePitch(p) { return clamp(p, 0.7, 1.5); }

  function utter(text) {
    var u = new SpeechSynthesisUtterance(text);
    var v = selectedVoice();
    if (v) { u.voice = v; u.lang = v.lang; } else { u.lang = "en-US"; }
    u.rate = effectiveRate($("#rate").value); u.pitch = effectivePitch($("#pitch").value); u.volume = 1;
    return u;
  }

  /* ---------------- Playback: a queue of short utterances ---------------- */
  var timers = {};
  function clearTimers() { Object.keys(timers).forEach(function (k) { clearTimeout(timers[k]); }); timers = {}; }
  function estimateMs(text, rate) { return 1000 * text.length / (14 * (rate || 1)); }

  var keepAlive = null;   // Chrome desktop's online voices stop after ~15 s unless nudged
  function startKeepAlive() {
    stopKeepAlive();
    if (IS_NATIVE || IS_MOBILE || IS_APPLE_WEBKIT || !synth.pause) return;
    keepAlive = setInterval(function () {
      var v = selectedVoice();
      if (state === "playing" && v && v.localService === false && synth.speaking && !synth.paused) { synth.pause(); synth.resume(); }
    }, 10000);
  }
  function stopKeepAlive() { if (keepAlive) clearInterval(keepAlive); keepAlive = null; }

  // NOTE: must stay synchronous from the click handler to the first synth.speak() (iOS requires it).
  function speakFrom(index) {
    if (!synth || !queue.length) return;
    var id = ++runId;
    clearTimers();
    if (synth.speaking || synth.pending || synth.paused) synth.cancel();   // clear a stuck/old queue first
    if (synth.paused && synth.resume) synth.resume();
    state = "playing"; updateButtons(); startKeepAlive();
    speakChunk(Math.max(0, Math.min(index, queue.length - 1)), id, 0);
  }

  function speakChunk(i, id, attempt) {
    if (id !== runId) return;
    if (i >= queue.length) { finish(); return; }
    pos = i;
    var item = queue[i];
    highlight(i);
    var u = utter(item.say), started = false, done = false;
    var advance = function () {
      if (done || id !== runId) return; done = true; clearTimers();
      var gap = Math.round(item.gap / Math.max(0.6, u.rate || 1));
      if (document.hidden || !gap) speakChunk(i + 1, id, 0);                 // background tabs throttle timers
      else timers.gap = setTimeout(function () { speakChunk(i + 1, id, 0); }, gap);
    };
    var retry = function () { if (done || id !== runId) return; done = true; clearTimers(); synth.cancel(); speakChunk(i, id, attempt + 1); };
    u.onstart = function () { started = true; };
    u.onend = advance;
    u.onerror = function (e) {
      var err = (e && e.error) || "";
      if (err === "interrupted" || err === "canceled" || done || id !== runId) return;
      if (attempt < 2 && u.voice && /network|synthesis|voice|unavailable|language/.test(err)) {
        badVoices[voiceKey(u.voice)] = true; retry(); return;   // e.g. online voice while offline → next best voice
      }
      advance();
    };
    // Watchdogs: an utterance can be silently dropped (Safari right after cancel, Chrome stuck queue) or never "end".
    timers.start = setTimeout(function () {
      if (started || done || id !== runId || synth.speaking || synth.pending) return;
      if (attempt < 1) retry(); else advance();
    }, 3000);
    timers.end = setTimeout(function () {
      if (done || id !== runId) return;
      if (synth.speaking) { done = true; clearTimers(); synth.cancel(); done = false; }
      advance();
    }, estimateMs(item.say, u.rate) * 2.5 + 5000);
    synth.speak(u);
  }

  function highlight(i) {
    var item = queue[i]; if (!item) return;
    segments.forEach(function (s, k) { s.el.classList.toggle("reading", k === item.seg); });
    var prev = document.querySelector(".sent.reading-now"); if (prev && prev !== item.span) prev.classList.remove("reading-now");
    if (item.span) item.span.classList.add("reading-now");
    var el = item.span || segments[item.seg].el;
    if (el && $("#follow").checked) {
      var r = el.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 200) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function clearHighlight() {
    segments.forEach(function (s) { s.el.classList.remove("reading"); });
    Array.prototype.forEach.call(document.querySelectorAll(".sent.reading-now"), function (s) { s.classList.remove("reading-now"); });
  }

  function finish() {
    clearTimers(); stopKeepAlive();
    state = "idle"; pos = 0; clearHighlight(); updateButtons();
    $("#status").textContent = "The End! 🌟 Make another story, or listen again.";
  }

  // Pause = cancel + remember the sentence; "Keep listening" restarts that sentence.
  // (Native pause/resume is unreliable on iOS and Android, so this works the same everywhere.)
  function pauseSpeech() {
    if (state !== "playing") return;
    runId++; clearTimers(); stopKeepAlive(); synth.cancel(); state = "paused"; updateButtons();
  }
  function playPause() {
    if (!synth) return;
    if (state === "playing") pauseSpeech();
    else speakFrom(state === "paused" ? pos : 0);
  }

  function stopSpeech() {
    runId++; clearTimers(); stopKeepAlive();
    if (synth) synth.cancel();
    state = "idle"; pos = 0; clearHighlight(); updateButtons();
  }

  function restartIfPlaying() { if (state === "playing") speakFrom(pos); }
  // Small API for recorder.js ("Record yourself reading").
  root.SnuggleApp = {
    story: function () { return current; },
    script: function () {   // every line the narrator reads, in order, with its display text
      return queue.map(function (it) {
        var sg = segments[it.seg];
        return { text: it.span ? it.span.textContent.trim() : sg.el.textContent.trim(), kind: sg.kind, seg: it.seg };
      });
    },
    isUnlocked: function () { return U.isUnlocked(); },
    onUnlockChange: function (fn) { U.onChange(fn); },
    openUpsell: function (ctx) { openUpsell(ctx); },
    parentGate: function (purpose, then) { parentGate(purpose, then); },
    closeModal: function () { closeModal(); },
    stopSpeech: function () { stopSpeech(); },
    clean: function (t) { return speakable(t); }
  };

  root.SnuggleSpeech = { splitDisplay: splitDisplay, speakable: speakable, voiceQuality: voiceQuality,   // for tests
    effectiveRate: effectiveRate, state: function () { return { state: state, pos: pos, queue: queue.length }; } };

  function updateButtons() {
    var pp = $("#play");
    if (state === "playing") { pp.innerHTML = '<span aria-hidden="true">⏸️</span> Pause'; pp.classList.add("is-playing"); }
    else if (state === "paused") { pp.innerHTML = '<span aria-hidden="true">▶️</span> Keep listening'; pp.classList.remove("is-playing"); }
    else { pp.innerHTML = '<span aria-hidden="true">🎧</span> Listen'; pp.classList.remove("is-playing"); }
    $("#stop").disabled = state === "idle";
    $("#mini").hidden = state === "idle";
    $("#mini-play").innerHTML = state === "playing" ? "⏸️ Pause" : "▶️ Play";
    $("#mini-label").textContent = state === "playing" ? "🎧 Reading…" : "⏸️ Paused";
    $("#status").textContent = !synth ? "" : state === "playing" ? "Reading aloud… tap any paragraph to jump there."
      : state === "paused" ? "Paused. Press Keep listening to carry on." : "Press Listen to hear the story.";
  }

  function download() {
    if (!current) return;
    var blob = new Blob([storyToText(current)], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (current.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "story") + ".txt";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
  }

  function init() {
    buildThemeGrid();
    var f = prefs.form;
    if (f) {
      $("#child-name").value = f.name || "";
      setRadio("pronoun", f.pronoun === "they" ? "she" : f.pronoun); setRadio("age", f.age); setRadio("theme", f.theme);
      setRadio("mood", f.mood); setRadio("length", f.length);
    }
    initUnlock();
    initPersonalVoice();
    U.onChange(function () { if (synth) loadVoices(); });
    // Voice update v2: old saved voice/pitch came from the previous (sometimes robotic) auto-pick. Start fresh once.
    if (prefs.voiceVer !== 2) {
      delete prefs.voice; if (prefs.pitch == 1.05) delete prefs.pitch;
      prefs.voiceVer = 2; savePrefs();
    }
    if (prefs.rate) $("#rate").value = clamp(prefs.rate, 0.6, 1.3);
    if (prefs.pitch) $("#pitch").value = clamp(prefs.pitch, 0.7, 1.5);
    var showVals = function () {
      $("#rate-val").textContent = (+$("#rate").value).toFixed(2) + "×";
      $("#pitch-val").textContent = (+$("#pitch").value).toFixed(2);
    };
    showVals();

    $("#story-form").addEventListener("submit", function (e) { e.preventDefault(); makeStory(false); });
    $("#surprise").addEventListener("click", function () { makeStory(true); });
    $("#again").addEventListener("click", function () { makeStory(false); });
    $("#play").addEventListener("click", playPause);
    $("#stop").addEventListener("click", stopSpeech);
    $("#mini-play").addEventListener("click", playPause);
    $("#mini-stop").addEventListener("click", stopSpeech);
    $("#download").addEventListener("click", download);
    $("#print").addEventListener("click", function () { window.print(); });
    $("#reset-voice").addEventListener("click", function () {
      $("#rate").value = 0.9; $("#pitch").value = 1; showVals();
      prefs.rate = prefs.pitch = undefined; savePrefs(); restartIfPlaying();
    });
    ["rate", "pitch"].forEach(function (id) {
      $("#" + id).addEventListener("input", showVals);
      $("#" + id).addEventListener("change", function () { prefs[id] = $("#" + id).value; savePrefs(); restartIfPlaying(); });
    });
    $("#voice").addEventListener("change", function () { prefs.voice = $("#voice").value; savePrefs(); restartIfPlaying(); });
    $("#test-voice").addEventListener("click", function () {
      if (!synth) return;
      stopSpeech();   // synchronous → speak stays inside the tap (iOS)
      synth.speak(utter("Once upon a time, a sleepy little star yawned and said goodnight. Are you ready for a story?"));
    });
    var tipX = $("#voice-tip-close");
    if (tipX) tipX.addEventListener("click", function () { prefs.voiceTipClosed = true; savePrefs(); $("#voice-tip").hidden = true; });

    if (!synth || typeof window.SpeechSynthesisUtterance === "undefined") {
      $("#no-tts").hidden = false;
      $("#play").disabled = true; $("#test-voice").disabled = true;
      $("#voice-field").hidden = true;
    } else {
      loadVoices();
      if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", loadVoices);
      else synth.onvoiceschanged = loadVoices;
      // getVoices() is async (iOS/Safari often return [] at first and may not fire voiceschanged): poll briefly.
      [250, 700, 1500, 3000, 6000].forEach(function (ms) { setTimeout(function () { if (voices.length < 2) loadVoices(); }, ms); });
      window.addEventListener("beforeunload", function () { synth.cancel(); });
      window.addEventListener("pagehide", function () { if (state === "playing") pauseSpeech(); });
      // Phones stop speech (or throttle our timers) when the app is hidden or the screen locks:
      // pause cleanly so "Keep listening" resumes from the same sentence. Desktop keeps reading.
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) { if (state === "playing" && IS_MOBILE && !IS_NATIVE) pauseSpeech(); }
        else if (state === "playing" && !synth.speaking && !synth.pending) speakFrom(pos);   // stuck after returning
      });
      document.addEventListener("keydown", function (e) { // space bar = play/pause when not typing
        if (e.code === "Space" && current && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) { e.preventDefault(); playPause(); }
      });
    }
    updateButtons();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : globalThis);
