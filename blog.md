# I built PadForward because sometimes you just need a pad

A few days ago, I unexpectedly got my period while I was out.

I hadn't planned for it, I didn't have a pad with me, and I happened to be near a train station, so I did what seemed like the obvious thing — I went looking for one there.

I expected that a train station would have some way of helping with something as basic as a sanitary product.

It didn't.

I had money. I could have bought one if I could find a shop, and I had enough options to eventually figure it out. But in that moment, I still ended up using toilet paper.

And that got me thinking.

Not just about people who can't afford menstrual products, but about how **needing a pad unexpectedly can happen to anyone**.

You forget to put one in your bag. Your period comes earlier than expected. You thought you had one left but don't. You're travelling. You're somewhere unfamiliar. You simply didn't think you'd need one that day.

It happens to the best of us.

And then there is the other problem that nobody really talks about enough.

## "Does anyone have a pad?"

Even if someone around me had a spare pad, would I actually walk up to them and ask?

Maybe.

But probably not.

We say periods are normal, and they absolutely are. But that doesn't mean asking a random person for a pad in a crowded train station suddenly feels completely normal.

There is that little moment of hesitation.

*Do I really want to ask someone?*

*Who do I ask?*

*What if they don't have one?*

*What if this becomes awkward?*

And if you're already stressed because you've unexpectedly got your period, the last thing you want is another problem to solve.

That's where **PadForward** came from.

---

# So, what is PadForward?

PadForward is a community-powered network for finding and donating menstrual products in public places.

The basic idea is pretty simple: **if you need a pad, find one nearby without having to ask someone, and if you have spare pads, help put them somewhere they're likely to be needed.**

Think of it as a community layer sitting on top of places people already use — train stations, bus stations, universities, workplaces, community centres and eventually other public spaces.

Someone might donate 20 pads today.

Someone else might need one tomorrow.

Those two people never have to meet.

They don't need to know each other's names.

They don't even need to know who helped whom.

PadForward simply connects the two.

---

# If you need one, you shouldn't have to ask

The first thing I wanted to get right was the emergency experience.

Imagine you're at Central Station and suddenly realise you need a pad.

You open PadForward and tap **"I Need a Pad."**

You don't need an account.

You don't need to explain what happened.

You don't need to post a request.

You just see what's nearby.

For example:

**Central Station**
🟢 Available
Verified 12 minutes ago
4 min walk

**Town Hall**
🟡 A few reported
Verified 28 minutes ago
6 min walk

**Museum**
🔴 None reported
Verified 18 minutes ago
3 min walk

You pick the closest available location and get directions.

That's it.

No awkward conversation required.

And afterwards, instead of asking for anything back, PadForward can simply say:

> **Someone helped you today. When you're able, help someone else.**

---

# But where do the pads come from?

This is where the other half of PadForward comes in.

Maybe I have a packet of pads at home and want to donate some.

I don't necessarily know which station needs them.

I don't want to spend an hour researching where to take them.

So I can tell PadForward:

> **I have 20 pads. Where should I donate them?**

PadForward looks at the current community supply information and the need at different locations and recommends somewhere that needs them.

For example:

**Museum Station**

🔴 Critical
Need Score: 94/100
No recent community supply reported
High estimated demand

So instead of simply donating somewhere, I'm donating **where the network needs them most**.

That's the part I really like about this idea.

It turns a small thing sitting in my cupboard into something that might be exactly where another person needs it.

---

# And yes, I'm using Solana for the donation

I also wanted the Solana integration to actually mean something in the product, rather than adding blockchain just so I could say I used blockchain.

So PadForward has a **"Donate a Pad"** flow using Solana.

The idea is that you can sponsor a pad — or several pads — through a Solana transaction, with the donation recorded transparently on-chain.

The physical fulfilment happens through the PadForward community and partner network, so the blockchain isn't pretending to magically move a physical pad from one place to another.

Instead, it gives us a transparent digital record of the generosity behind it.

So the flow becomes:

**Donate a pad → Solana transaction → PadForward donation → community supply point → someone can access a pad when they need one.**

I like this because the unit of generosity is really easy to understand.

**One donation. One pad. One small act that could make someone's day a little easier.**

And you don't need to be a crypto person to use it.

The blockchain is underneath the experience rather than becoming the experience.

---

# I didn't want another chatbot

The other technology I really wanted to use properly was Google AI.

I could have added a chatbot that answered questions about periods, but that didn't feel particularly useful.

Instead, PadForward has an AI agent that can actually interact with the application.

You can say:

> "I suddenly got my period and I'm at Central."

The agent can understand that you need a nearby pad, find relevant locations, check their current community supply and help you choose one.

Or you can say:

> "I have 20 pads to donate."

The agent can look at the current need across nearby stations and recommend where they would be most useful.

You can even report something naturally:

> "The donation box at Town Hall is empty."

The AI can understand that this is a supply report and pass it through the application's backend rather than just replying with a paragraph of text.

So Gemini isn't there just to have a conversation.

**It's there to help the network make decisions and take actions.**

---

# What if the map says there are pads, but there aren't?

This was another thing I didn't want to fake.

Real-world inventory is messy.

I can't claim that PadForward always knows exactly how many pads are sitting inside a station.

Instead, the community helps keep the information fresh.

Anyone can report:

🟢 **Plenty**

🟡 **A few**

🔴 **None**

⚪ **Not sure**

The report also has a timestamp, so you might see:

> 🟢 Available — verified 14 minutes ago

rather than pretending the information is permanently accurate.

Reports from community champions and multiple recent reports can give us more confidence, while old or conflicting reports can lower it.

Over time, this could become a really interesting data problem too — figuring out where demand is happening and when stations tend to run low.

---

# The people who keep it going

Some people might want to do more than make a one-off donation.

That's where **Pad Champions** come in.

You could adopt a local station and help keep an eye on its community supply.

A champion could verify that a donation point still has supplies, report when it is empty, confirm a restock or help coordinate donations.

The idea is that PadForward shouldn't just be a map that people open when they have a problem.

It should become a little community network that people help maintain.

---

# The bigger idea is the network

This is the part that excites me most.

The actual product isn't really the map.

It's the network behind it.

```text
Someone has spare pads
          ↓
PadForward finds where they're needed
          ↓
Community supply point
          ↓
Someone unexpectedly needs one
          ↓
They find it without asking
          ↓
When they're able, they pay it forward
```

The donor may never know who received the pad.

The person who received it may never know who donated it.

And that's completely fine.

**Generosity doesn't always need a face attached to it.**

Sometimes it can just be:

*"Someone left one for you."*

---

# There's a lot more I want to do with it

For the hackathon, I'm starting with public transport locations because they make the problem very tangible.

But the same idea could work in universities, workplaces, libraries, community centres, airports, shelters and other places where people spend time.

I'd also like to explore route-based discovery, so someone travelling from Parramatta to Central could ask:

> "Is there somewhere I can get a pad without making a big detour?"

There is also a lot of interesting work to do around demand prediction, restock alerts, voice accessibility, multilingual support and using analytics to understand where the network needs help.

Snowflake could help with the longer-term demand and supply analytics, while ElevenLabs could make the experience more accessible through voice.

But those are extensions.

The core idea stays the same.

---

# Why PadForward?

I started with a very ordinary, slightly inconvenient experience.

I unexpectedly needed a pad.

I couldn't find one.

And I realised that even though I had the means to solve the problem eventually, **getting something so basic wasn't as easy as it should have been.**

That made me think about everyone else who might find themselves in the same situation.

Not just someone who can't afford a pad.

Anyone.

Because sometimes you forget.

Sometimes you don't expect it.

Sometimes you're just in the wrong place at the wrong time.

And sometimes there might actually be someone nearby who has exactly what you need — but asking them feels like a bigger deal than it should.

**PadForward is my attempt to remove that gap.**

No asking.

No explaining.

Just access.

And if you have one to spare?

**Pass it forward. 💗**
