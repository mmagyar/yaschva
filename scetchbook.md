When can a schema have keyOf in it;
 - Root is object
 - Root is map
   - Root is array
 - Root is one of type, but only when in an option that is an object or map
 - Root is meta of any of the above


 When it's not possible at all:
  - Root is primitive
  - Root is enum
  - Root is string
  - Root is number
  - Root is literal
  - Root is one of type, but it's only primitives

So based on these, the current schema is fine.

One change is that i may need to enable the keyof for arrays, with indexes as keys



  Since we have a random seed we can set, idea;
   It it puts keyofs in a schema where it's invalid, we can rerun it and just chose an option without keyof 


generated keyof fails with these validation errors, which are valid

beacase
  "s`uT1%(AAtY3EA# !6,!84gN]^Aq-:8[_9Ry=8Rj6n+s9": {
      "$keyOf": [
        "%A_~sY$>w[)$.ZD\"<B`UERnu}P;L!}EiE02y5a$}a+oYV5poTo>6~IaeZ@L8YZjtXZ[n/4d"
      ]
    },


      "%A_~sY$>w[)$.ZD\"<B`UERnu}P;L!}EiE02y5a$}a+oYV5poTo>6~IaeZ@L8YZjtXZ[n/4d": {
    "name": "nKSS",
    "description": "dQSmt5GWLWjezwQ",
    "$enum": [
      "6904gil4",
      "akWy6SJZK3ZVaVR",
      "nYksEC"
    ]
  }

  it is not valid, since an enum type cannot be the target of a keyof
```

 {
        "error": "objectResult",
        "depth": 9,
        "errorCount": 1,
        "objectResults": {
          "$keyOf": {
            "error": "String did not match required regex",
            "depth": 9,
            "value": "$keyOf"
          }
        }
      },
      {
        "error": "objectResult",
        "depth": 9,
        "errorCount": 1,
        "objectResults": {
          "$keyOf": {
            "error": "The value under final key did not have the desired type",
            "depth": 9,
            "value": "[object ommited]"
          },
          "valueType": null
        }
      },

      ```