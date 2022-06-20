combine ERC20/ERC721 events, methods, structs etc if poss for code neatness

Split up events and make more concise:

- initial registration
- price update
- further tokens added to a listing

Also decide what needs to be indexed in events

What return statements are needed? For calls from other contracts

Do we want to delete the listing struct from storage when a buy is made for all remaining tokens

WHAT OTHER ADMIN EFFECTS COULD WE NEED? e.g. pauseable, only permitting certain tokens...
