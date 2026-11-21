  /* ============================================================
     SMT TOPIC 05 (b) · refactoring

     "A series of small behaviour-preserving transformations" is an
     unusually checkable definition, so the video-store example is
     carried through its whole chain here — seven versions of the
     same statement() — and the suite runs every version against
     every other on every basket it can build.

     The two statements the notes print are the ground truth. They
     are reproduced character for character, including the padding in
     the movie titles.

     Algorithms only — no DOM.
     ============================================================ */

  var RF_REGULAR = 0, RF_NEW_RELEASE = 1, RF_CHILDRENS = 2;

  var RF_CODES = [
    { code: RF_REGULAR, name: 'REGULAR' },
    { code: RF_NEW_RELEASE, name: 'NEW_RELEASE' },
    { code: RF_CHILDRENS, name: 'CHILDRENS' }
  ];

  function rfMovie(title, priceCode) { return { title: title, priceCode: priceCode }; }
  function rfRental(movie, daysRented) { return { movie: movie, daysRented: daysRented }; }
  function rfCustomer(name, rentals) { return { name: name, rentals: rentals }; }

  /* Java prints a double as "3.5" and a whole one as "2.0". The
     statements in the notes are full of both, so the formatting has
     to match or nothing below can be compared to them. */
  function rfNum(x) {
    var r = Math.round(x * 1e6) / 1e6;
    return Number.isInteger(r) ? r.toFixed(1) : String(r);
  }

  /* ---------------------------------------------------------------
     Version 0 · everything in statement(), as it starts.
     --------------------------------------------------------------- */

  function rfV0(customer) {
    var totalAmount = 0, frequentRenterPoints = 0;
    var result = '\nRental Record for ' + customer.name + '\n';
    customer.rentals.forEach(function (each) {
      var thisAmount = 0;
      switch (each.movie.priceCode) {
        case RF_REGULAR:
          thisAmount += 2;
          if (each.daysRented > 2) thisAmount += (each.daysRented - 2) * 1.5;
          break;
        case RF_NEW_RELEASE:
          thisAmount += each.daysRented * 3;
          break;
        case RF_CHILDRENS:
          thisAmount += 1.5;
          if (each.daysRented > 3) thisAmount += (each.daysRented - 3) * 1.5;
          break;
      }
      frequentRenterPoints++;
      if (each.movie.priceCode === RF_NEW_RELEASE && each.daysRented > 1) {
        frequentRenterPoints++;
      }
      result += '\t' + each.movie.title + '\t' + rfNum(thisAmount) + '\n';
      totalAmount += thisAmount;
    });
    result += 'Amount owed is ' + rfNum(totalAmount) + '\n';
    result += 'You earned ' + frequentRenterPoints + ' frequent renter points\n';
    return result;
  }

  /* ---------------------------------------------------------------
     Version 1 · extract method: amountFor(each).
     --------------------------------------------------------------- */

  function rfAmountFor(each) {
    var thisAmount = 0;
    switch (each.movie.priceCode) {
      case RF_REGULAR:
        thisAmount += 2;
        if (each.daysRented > 2) thisAmount += (each.daysRented - 2) * 1.5;
        break;
      case RF_NEW_RELEASE:
        thisAmount += each.daysRented * 3;
        break;
      case RF_CHILDRENS:
        thisAmount += 1.5;
        if (each.daysRented > 3) thisAmount += (each.daysRented - 3) * 1.5;
        break;
    }
    return thisAmount;
  }

  function rfV1(customer) {
    var totalAmount = 0, frequentRenterPoints = 0;
    var result = '\nRental Record for ' + customer.name + '\n';
    customer.rentals.forEach(function (each) {
      var thisAmount = rfAmountFor(each);
      frequentRenterPoints++;
      if (each.movie.priceCode === RF_NEW_RELEASE && each.daysRented > 1) {
        frequentRenterPoints++;
      }
      result += '\t' + each.movie.title + '\t' + rfNum(thisAmount) + '\n';
      totalAmount += thisAmount;
    });
    result += 'Amount owed is ' + rfNum(totalAmount) + '\n';
    result += 'You earned ' + frequentRenterPoints + ' frequent renter points\n';
    return result;
  }

  /* ---------------------------------------------------------------
     Version 2 · rename the variables. `each` becomes `aRental`,
     `thisAmount` becomes `result`. Nothing else changes, which is
     the point: a rename is a refactoring with a provably empty diff
     in behaviour, and the only one of these steps where that is
     obvious without running anything.
     --------------------------------------------------------------- */

  function rfAmountForRenamed(aRental) {
    var result = 0;
    switch (aRental.movie.priceCode) {
      case RF_REGULAR:
        result += 2;
        if (aRental.daysRented > 2) result += (aRental.daysRented - 2) * 1.5;
        break;
      case RF_NEW_RELEASE:
        result += aRental.daysRented * 3;
        break;
      case RF_CHILDRENS:
        result += 1.5;
        if (aRental.daysRented > 3) result += (aRental.daysRented - 3) * 1.5;
        break;
    }
    return result;
  }

  function rfV2(customer) {
    var totalAmount = 0, frequentRenterPoints = 0;
    var statement = '\nRental Record for ' + customer.name + '\n';
    customer.rentals.forEach(function (aRental) {
      var amount = rfAmountForRenamed(aRental);
      frequentRenterPoints++;
      if (aRental.movie.priceCode === RF_NEW_RELEASE && aRental.daysRented > 1) {
        frequentRenterPoints++;
      }
      statement += '\t' + aRental.movie.title + '\t' + rfNum(amount) + '\n';
      totalAmount += amount;
    });
    statement += 'Amount owed is ' + rfNum(totalAmount) + '\n';
    statement += 'You earned ' + frequentRenterPoints + ' frequent renter points\n';
    return statement;
  }

  /* ---------------------------------------------------------------
     Version 3 · move method. amountFor() uses nothing from Customer
     and everything from Rental — feature envy — so it becomes
     Rental.getCharge().
     --------------------------------------------------------------- */

  function rfGetCharge(rental) { return rfAmountForRenamed(rental); }

  function rfV3(customer) {
    var totalAmount = 0, frequentRenterPoints = 0;
    var statement = '\nRental Record for ' + customer.name + '\n';
    customer.rentals.forEach(function (aRental) {
      frequentRenterPoints++;
      if (aRental.movie.priceCode === RF_NEW_RELEASE && aRental.daysRented > 1) {
        frequentRenterPoints++;
      }
      statement += '\t' + aRental.movie.title + '\t' + rfNum(rfGetCharge(aRental)) + '\n';
      totalAmount += rfGetCharge(aRental);
    });
    statement += 'Amount owed is ' + rfNum(totalAmount) + '\n';
    statement += 'You earned ' + frequentRenterPoints + ' frequent renter points\n';
    return statement;
  }

  /* ---------------------------------------------------------------
     Version 4 · extract the points calculation the same way.
     --------------------------------------------------------------- */

  function rfGetFrequentRenterPoints(rental) {
    if (rental.movie.priceCode === RF_NEW_RELEASE && rental.daysRented > 1) return 2;
    return 1;
  }

  function rfV4(customer) {
    var totalAmount = 0, frequentRenterPoints = 0;
    var statement = '\nRental Record for ' + customer.name + '\n';
    customer.rentals.forEach(function (aRental) {
      frequentRenterPoints += rfGetFrequentRenterPoints(aRental);
      statement += '\t' + aRental.movie.title + '\t' + rfNum(rfGetCharge(aRental)) + '\n';
      totalAmount += rfGetCharge(aRental);
    });
    statement += 'Amount owed is ' + rfNum(totalAmount) + '\n';
    statement += 'You earned ' + frequentRenterPoints + ' frequent renter points\n';
    return statement;
  }

  /* ---------------------------------------------------------------
     Version 5 · replace the temps with queries. Once totalAmount and
     frequentRenterPoints are methods, statement() holds nothing but
     presentation — which is what makes the HTML version possible.
     --------------------------------------------------------------- */

  function rfGetTotalCharge(customer) {
    return customer.rentals.reduce(function (t, r) { return t + rfGetCharge(r); }, 0);
  }

  function rfGetTotalFrequentRenterPoints(customer) {
    return customer.rentals.reduce(function (t, r) {
      return t + rfGetFrequentRenterPoints(r);
    }, 0);
  }

  function rfV5(customer) {
    var statement = '\nRental Record for ' + customer.name + '\n';
    customer.rentals.forEach(function (aRental) {
      statement += '\t' + aRental.movie.title + '\t' + rfNum(rfGetCharge(aRental)) + '\n';
    });
    statement += 'Amount owed is ' + rfNum(rfGetTotalCharge(customer)) + '\n';
    statement += 'You earned ' + rfGetTotalFrequentRenterPoints(customer) +
      ' frequent renter points\n';
    return statement;
  }

  /* ---------------------------------------------------------------
     Version 6 · replace the type code with state. The switch becomes
     a Price subclass per code, and getCharge moves into it.

     This is the step the whole chain was for. Adding a fourth
     classification now means adding a class; before it meant finding
     every switch.
     --------------------------------------------------------------- */

  var RF_PRICES = {};
  RF_PRICES[RF_REGULAR] = {
    name: 'RegularPrice',
    getCharge: function (days) {
      var result = 2;
      if (days > 2) result += (days - 2) * 1.5;
      return result;
    },
    getFrequentRenterPoints: function () { return 1; }
  };
  RF_PRICES[RF_NEW_RELEASE] = {
    name: 'NewReleasePrice',
    getCharge: function (days) { return days * 3; },
    getFrequentRenterPoints: function (days) { return days > 1 ? 2 : 1; }
  };
  RF_PRICES[RF_CHILDRENS] = {
    name: 'ChildrensPrice',
    getCharge: function (days) {
      var result = 1.5;
      if (days > 3) result += (days - 3) * 1.5;
      return result;
    },
    getFrequentRenterPoints: function () { return 1; }
  };

  function rfChargeV6(rental) {
    return RF_PRICES[rental.movie.priceCode].getCharge(rental.daysRented);
  }
  function rfPointsV6(rental) {
    return RF_PRICES[rental.movie.priceCode].getFrequentRenterPoints(rental.daysRented);
  }

  function rfV6(customer) {
    var statement = '\nRental Record for ' + customer.name + '\n';
    customer.rentals.forEach(function (aRental) {
      statement += '\t' + aRental.movie.title + '\t' + rfNum(rfChargeV6(aRental)) + '\n';
    });
    var total = customer.rentals.reduce(function (t, r) { return t + rfChargeV6(r); }, 0);
    var points = customer.rentals.reduce(function (t, r) { return t + rfPointsV6(r); }, 0);
    statement += 'Amount owed is ' + rfNum(total) + '\n';
    statement += 'You earned ' + points + ' frequent renter points\n';
    return statement;
  }

  /* The feature that the refactoring was for. Not a refactoring: it
     adds behaviour, and it is written with the other hat on. */
  function rfHtmlStatement(customer) {
    var result = '\n<h1>Rental Record for ' + customer.name + '</h1>\n<table>\n';
    customer.rentals.forEach(function (aRental) {
      result += '\t<tr><td>' + aRental.movie.title + '</td><td>' +
        rfNum(rfChargeV6(aRental)) + '</td></tr>\n';
    });
    result += '</table>\n';
    result += '<p>Amount owed is <b>' + rfNum(rfGetTotalCharge(customer)) + '</b></p>\n';
    result += '<p>You earned <b>' + rfGetTotalFrequentRenterPoints(customer) +
      '</b> frequent renter points</p>\n';
    return result;
  }

  var RF_VERSIONS = [
    { id: 'original', name: 'everything in statement()', run: rfV0,
      change: 'the starting point: pricing, points and presentation in one method',
      smells: ['Long Method', 'Switch Statements', 'Duplicated Code'] },
    { id: 'extract', name: 'extract method amountFor()', run: rfV1,
      change: 'the pricing comes out of the loop',
      smells: ['Long Method'] },
    { id: 'rename', name: 'rename the variables', run: rfV2,
      change: 'each → aRental, thisAmount → result',
      smells: [] },
    { id: 'move', name: 'move amountFor() to Rental', run: rfV3,
      change: 'it used nothing from Customer, which is feature envy',
      smells: ['Feature Envy'] },
    { id: 'points', name: 'extract getFrequentRenterPoints()', run: rfV4,
      change: 'the same move for the other calculation',
      smells: ['Feature Envy'] },
    { id: 'queries', name: 'replace the temps with queries', run: rfV5,
      change: 'statement() now holds only presentation',
      smells: ['Temporary Field'] },
    { id: 'state', name: 'replace the type code with state', run: rfV6,
      change: 'the switch becomes a Price subclass per classification',
      smells: ['Switch Statements'] }
  ];

  /* ---------------------------------------------------------------
     The two customers from the notes, with the padded titles.
     --------------------------------------------------------------- */

  var RF_MOVIES = {
    python: rfMovie('Monty Python and the Holy Grail', RF_REGULAR),
    trek: rfMovie('Star Trek 27                   ', RF_NEW_RELEASE),
    wars: rfMovie('Star Wars                      ', RF_REGULAR),
    shrek: rfMovie('Shrek                          ', RF_CHILDRENS)
  };

  var RF_CUSTOMERS = {
    'Dinsdale Pirhana': rfCustomer('Dinsdale Pirhana', [
      rfRental(RF_MOVIES.python, 3),
      rfRental(RF_MOVIES.trek, 3),
      rfRental(RF_MOVIES.wars, 4),
      rfRental(RF_MOVIES.shrek, 6)
    ]),
    'George W. Bush': rfCustomer('George W. Bush', [
      rfRental(RF_MOVIES.python, 1),
      rfRental(RF_MOVIES.trek, 4),
      rfRental(RF_MOVIES.wars, 2)
    ])
  };

  /* ---------------------------------------------------------------
     Behaviour preservation, measured.

     Every basket of up to three rentals drawn from three
     classifications and twelve rental lengths, put through every
     version. If a step changed behaviour, this is where it shows.
     --------------------------------------------------------------- */

  function rfBaskets(maxDays, maxRentals) {
    var days = [], d, out = [];
    for (d = 1; d <= maxDays; d++) days.push(d);
    var singles = [];
    RF_CODES.forEach(function (c) {
      days.forEach(function (n) {
        singles.push(rfRental(rfMovie('M' + c.name + n, c.code), n));
      });
    });
    out.push(rfCustomer('Nobody', []));
    singles.forEach(function (a) {
      out.push(rfCustomer('One', [a]));
    });
    if (maxRentals >= 2) {
      singles.forEach(function (a) {
        singles.forEach(function (b) { out.push(rfCustomer('Two', [a, b])); });
      });
    }
    return out;
  }

  function rfAgreement(maxDays, maxRentals) {
    var baskets = rfBaskets(maxDays || 12, maxRentals === undefined ? 2 : maxRentals);
    var disagreements = [];
    baskets.forEach(function (c) {
      var want = RF_VERSIONS[0].run(c);
      RF_VERSIONS.slice(1).forEach(function (v) {
        var got = v.run(c);
        if (got !== want && disagreements.length < 8) {
          disagreements.push({ version: v.id, basket: c, want: want, got: got });
        }
      });
    });
    return { baskets: baskets.length,
             comparisons: baskets.length * (RF_VERSIONS.length - 1),
             disagreements: disagreements };
  }

  /* The charge table, which is what a reader actually wants to see. */
  function rfChargeTable(maxDays) {
    var rows = [], d;
    for (d = 1; d <= (maxDays || 8); d++) {
      rows.push({
        days: d,
        regular: rfChargeV6(rfRental(rfMovie('x', RF_REGULAR), d)),
        newRelease: rfChargeV6(rfRental(rfMovie('x', RF_NEW_RELEASE), d)),
        childrens: rfChargeV6(rfRental(rfMovie('x', RF_CHILDRENS), d)),
        pointsNew: rfPointsV6(rfRental(rfMovie('x', RF_NEW_RELEASE), d))
      });
    }
    return rows;
  }

  /* ---------------------------------------------------------------
     The catalogue, transcribed.
     --------------------------------------------------------------- */

  var RF_SMELLS = [
    'Duplicated Code', 'Long Method', 'Large Class', 'Long Parameter List',
    'Divergent Change', 'Shotgun Surgery', 'Feature Envy', 'Data Clumps',
    'Primitive Obsession', 'Switch Statements', 'Parallel Interface Hierarchies',
    'Lazy Class', 'Speculative Generality', 'Temporary Field', 'Message Chains',
    'Middle Man', 'Inappropriate Intimacy', 'Incomplete Library Class', 'Data Class',
    'Refused Bequest'
  ];

  var RF_WHEN = [
    { when: 'Before you add a feature',
      why: 'to make the feature easier to add' },
    { when: 'When you need to fix a bug',
      why: 'a bug report is a sign the code was not clear enough for you to see the bug ' +
           'in the first place' },
    { when: 'When you do a code review',
      why: 'it spreads knowledge through the team; works best in small groups, and ' +
           'excellently with pair programming' }
  ];

  var RF_PROCESS = [
    'Analyse the change request',
    'Refactor to prepare for the change',
    'Test to assure a working version',
    'Integrate',
    'Implement the change request',
    'Test to assure a working version',
    'Refactor to clean up, if necessary',
    'Test to assure a working version',
    'Integrate'
  ];

  var RF_DESIGN = [
    'The code is appropriate for the intended audience',
    'The code passes all the tests',
    'The code communicates everything it needs to',
    'The code has the smallest number of classes',
    'Each class has the smallest number of methods'
  ];
