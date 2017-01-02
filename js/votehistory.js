/* jshint moz: true */
$( document ).ready( function () {
    const API_ROOT = "https://en.wikipedia.org/w/api.php",
          API_OPTIONS = "action=query&prop=revisions&rvprop=content&format=jsonfm",
          API_SUFFIX = "&format=json&callback=?&continue=";

    var listDiscussions = function () {
        var pageTitle = $( "#page" ).val().trim();
        $( "#error" ).hide();
        $( "#discussions" ).hide();
        $( "#analysis" ).hide();
        if ( pageTitle === "" ) {
            $( "#error" ).empty();
            $( "#error" ).show();
            $( "#error" ).append( $( "<div>" )
                               .addClass( "errorbox" )
                               .text( "No page specified." ) );
            return;
        }

        $( "#discussions" ).show();
        $( "#discussions" ).text( "Loading..." );

        var apiUrl = API_ROOT + "?" + API_OPTIONS + "&titles=" + pageTitle + API_SUFFIX;
        $.getJSON( apiUrl, function ( data ) {
            try {
                var pageid = Object.getOwnPropertyNames( data.query.pages )[0];

                if ( data.query.pages[ pageid ].hasOwnProperty( "missing" ) ) {
                    $( "#error" ).empty().show();
                    $( "#error" ).append( $( "<div> ")
                                          .addClass( "errorbox" )
                                          .text( "Page doesn't exist!" ) );
                    $( "#discussions" ).hide();
                    return;
                }

                var pageText = data.query.pages[ pageid ].revisions[0]["*"];
            } catch ( e ) {
                $( "#error" ).empty().show();
                $( "#error" ).append( $( "<div> ")
                                      .addClass( "errorbox" )
                                      .text( "Error while loading page text: " + e.message ) );
                $( "#discussions" ).hide();
                return;
            }
            $( "#discussions" ).empty();

            // We substring window.location.href because it already has the "page=___" stuff
            $( "#discussions" ).append( $( "<p>" )
                                        .addClass( "permalink" )
                                        .append( "(" )
                                        .append( $( "<a>" )
                                                 .attr( "href", window.location.href.
                                                        substring(0,window.location.href.indexOf("#page=")) +
                                                        "#page=" + encodeURIComponent( pageTitle ) )
                                                 .text( "permalink" ) )
                                        .append( " to these results)" ) );
            var sectionHeaders = pageText.match( /==+.+?==+/g );
            if ( VoteHistorySpecialCases.check( pageTitle ) ) {
                $( "#discussions" ).append( $( "<div>" )
                                            .addClass( "successbox" )
                                            .text( "Special discussion page detected at " )
                                            .append( $( "<a> " )
                                                     .attr( "href", "https://en.wikipedia.org/wiki/" + pageTitle )
                                                     .text( pageTitle ) )
                                            .append( "." ) );
                var showSupportPercentageGraph = pageTitle.startsWith( "Wikipedia:Requests for adminship/" );
                analyzeDiscussion( VoteHistorySpecialCases.getFunction( pageTitle )( pageText ),
                                   showSupportPercentageGraph );
            } else if ( !sectionHeaders ) {
                if ( getVotes( pageText ) || pageText.match( /\*/ ) ) {
                    $( "#discussions" ).append( $( "<div>" )
                                                .addClass( "successbox" )
                                                .append( "Single-discussion page detected at " )
                                                .append( $( "<a> " )
                                                         .attr( "href", "https://en.wikipedia.org/wiki/" + pageTitle )
                                                         .text( pageTitle ) )
                                                .append( "." ) );
                    analyzeDiscussion( pageText );
                } else {
                    $( "#discussions" ).hide();
                    $( "#error" ).empty().show();
                    $( "#error" ).append( $( "<div>" )
                                          .addClass( "errorbox" )
                                          .append( "I couldn't find any discussion headers on " )
                                          .append( $( "<a> " )
                                                     .attr( "href", "https://en.wikipedia.org/wiki/" + pageTitle )
                                                     .text( "the page" ) )
                                          .append( "." ) );
                }
            } else {
                $( "#discussions" ).append( $( "<h2>" ).text( "Discussions on " )
                                            .append( $( "<a> " )
                                                     .attr( "href", "https://en.wikipedia.org/wiki/" + pageTitle )
                                                     .text( pageTitle ) ) );
                sectionHeaders.forEach( function ( item, index ) {
                    var trailerRegex = ( index == sectionHeaders.length - 1 ) ? "" : "?==",
                        regex = item + "\n(\n|.)*" + trailerRegex;
                    var section = pageText.match( new RegExp( regex, "g" ) );
                    if ( !section ) return;
                    section = section[0];

                    var votes = getVotes( section );
                    var disabledAttr = votes ? {} : { "disabled": "disabled" };
                    var analyzeHandler = function ( e ) { analyzeDiscussion( section ); };
                    $( "#discussions" ).append( $( "<div>" )
                                                .addClass( "discussion" )
                                                .append( $( "<button>" )
                                                         .addClass( "mw-ui-button mw-ui-progressive" )
                                                         .addClass( "vote-history-analyze-button" )
                                                         .text( "Analyze >>" )
                                                         .attr( disabledAttr )
                                                         .click( analyzeHandler ) )
                                                .append( $( "<b>" ).text( item.replace( /=/g, "" ) ) )
                                                .append( $( "<i>" ).text( ( !votes ? "No votes" : ( votes.length + " votes" ) ) +
                                                                          "; " + section.length + " bytes" ) ) );
                } ); // end forEach on sectionHeaders
            } // end else block
        } ); // end JSON query handler
    }; // end listDiscussions()

    var getVotes = function ( voteText ) {
        voteText = voteText.replace( /=.+?=/, "" ).replace( /#/g, "*" );
        var matches = voteText.match( /\*\s*'''.+?'''[\s\S]*?\d\d:\d\d,\s\d{1,2}\s\w+?\s\d\d\d\d\s\(UTC\)/g );
        return matches;
    }

    var analyzeDiscussion = function ( discussionText, showSupportPercentageTable ) {
        $( "#analysis" )
            .show()
            .empty()
            .append( $( "<h2>" ).text( "Graph of vote totals over time" ) );

        var votes = getVotes( discussionText );
        if ( !votes ) {
            $( "#analysis" ).append( $( "<div>" )
                                     .addClass( "errorbox" )
                                     .text( "No votes found." ) );
            return;
        }

        var voteObjects = [];
        votes.forEach( function ( voteText ) {
            var vote = voteText.match( /'''.+?'''/ )[0].replace( /'''/g, "" ),
                timestamp = voteText.match( /\d\d:\d\d,\s\d{1,2}\s\w+\s\d\d\d\d/ )[0];
            vote = vote.replace( /Obvious/, "" ).replace( /Speedy/, "" ).trim();

	    // Votes that contain the string "support" (or "oppose", etc)
	    // are treated as if they consisted entirely of "support" (etc)
            [ "support", "oppose", "neutral" ].forEach( function ( voteType ) {
                if ( vote.toLowerCase().indexOf( voteType ) > -1 ) {
                    vote = voteType.charAt( 0 ).toUpperCase() + voteType.substring( 1 );
                }
            } );

	    // All other votes are transformed from xXxXx (or whatever) to Xxxxx
            vote = vote.charAt( 0 ).toUpperCase() + vote.substr( 1 ).toLowerCase();
            var voteObject = { "vote": vote, "time": moment( timestamp, "HH:mm, DD MMM YYYY" ) };
            voteObjects.push( voteObject );
        } );
        voteObjects.sort( function ( a, b ) { return a.time - b.time; } );

        // {"Support": 12, "Oppose": 6, ...}
        var voteTallies = {};
        voteObjects.forEach( function ( voteObject ) {
            if( voteTallies.hasOwnProperty( voteObject.vote ) ) {
                voteTallies[ voteObject.vote ]++;
            } else {
                voteTallies[ voteObject.vote ] = 1;
            }
        } );

        // We don't want options with only one vote to show up in the table
        var allowedVotes = Object.keys( voteTallies ).filter( function ( vote ) {
            return voteTallies[ vote ] > 1;
        } );

        // One of "Support" or "Oppose" present -> the other should also be shown
	if( allowedVotes.indexOf( "Support" ) > -1 && allowedVotes.indexOf( "Oppose" ) === -1 ) {
	    allowedVotes.push( "Oppose" );
	}
	if( allowedVotes.indexOf( "Oppose" ) > -1 && allowedVotes.indexOf( "Support" ) === -1 ) {
	    allowedVotes.push( "Support" );
	}

	// Actually filter the vote objects
        var filteredVoteObjects = voteObjects.filter( function ( voteObject ) {
            return allowedVotes.indexOf( voteObject.vote ) > -1;
        } );

	// Show the vote graph
        appendVoteGraphTo( "#analysis", filteredVoteObjects );

        // Show support percentage table
        if( showSupportPercentageTable ) {
            $( "#analysis" ).append( "<h2>Support percentage graph</h2>" );
            appendSupportPercentageGraphTo( "#analysis", filteredVoteObjects );
        }

	var voteTypes = allowedVotes;

	// Bring "Support"/"Oppose"/"Neutral" to the front in that order
	var fixedVoteTypes = [ "Support", "Oppose", "Neutral" ];
	for( var i = 0; i < fixedVoteTypes.length; i++ ) {
	    var currentIndex = voteTypes.indexOf( fixedVoteTypes[ i ] );
	    if( currentIndex > 0 ) {
		voteTypes[ currentIndex ] = voteTypes[ i ];
		voteTypes[ i ] = fixedVoteTypes[ i ];
	    }
	}

	// Show the vote tally table
        $( "#analysis" ).append( "<h2>Vote tally</h2>" );
        $( "#analysis" ).append( "<table><tr></tr></table>" );
        voteTypes.forEach( function ( voteType ) {
            $( "#analysis table tr" ).append( $( "<th>" ).text( voteType ) );
        } );
        $( "#analysis table" ).append( "<tr></tr>" );
        voteTypes.forEach( function ( voteType ) {
            $( "#analysis table tr" ).last().append( $( "<td>" ).text( voteTallies[ voteType ] ) );
        } );

        $( "#analysis" ).append( "<h2>Vote list</h2>" );

        // Show a note if we filtered any votes
        var numVotesFiltered = voteObjects.length - filteredVoteObjects.length;
        if( numVotesFiltered > 0 ) {
            $( "#analysis" ).append("<p><i>Including " + numVotesFiltered + " singleton vote" +
                                    ( numVotesFiltered === 1 ? "" : "s" ) + " that " +
				    ( numVotesFiltered === 1 ? "isn't" : "aren't" ) + " shown in the graph and table.</i></p>");
        }

        $( "#analysis" ).append( $( "<ul>" ) );
        voteObjects.forEach( function ( voteObject ) {
            $( "#analysis ul" ).append( $( "<li>" ).text( voteObject.vote + ", cast on " +
                                                          voteObject.time.format( "HH:mm, D MMMM YYYY" ) ) );
        } );

        if( $( "#analysis" ).offset().top > ( $( window ).scrollTop() + $( window ).height() ) ) {
            window.scrollTo( 0, $( "#analysis" ).offset().top );
        }
    }

    var appendVoteGraphTo = function ( location, voteObjects ) {
        const WIDTH = 650, HEIGHT = 250, MARGIN = { top: 15, bottom: 35, left: 50, right: 100 };
        var xScale = d3.time.scale()
            .range( [ 0, WIDTH ] )
            .domain( d3.extent( voteObjects, function ( d ) { return d.time; } ) );
        var earliestVoteTime = xScale.domain()[ 0 ]

        var voteTotals = {};
        voteObjects.forEach( function ( voteObject ) { voteTotals[ voteObject.vote ] = 1 + voteTotals[ voteObject.vote ] || 0; } )
        var yScale = d3.scale.linear()
            .range( [ HEIGHT, 0 ] )
            .domain( [ 0, d3.max( $.map( voteTotals, function ( value, key ) { return value; } ) ) + 5 ] );

        var xAxis = d3.svg.axis()
            .scale( xScale )
            .orient( "bottom" );
        var yAxis = d3.svg.axis()
            .scale( yScale )
            .orient( "left" );
        var voteRunningTotals = {};
        var line = d3.svg.line()
            .x( function ( d ) { return xScale( d.time ); } )
            .y( function ( d ) {
                if ( !voteRunningTotals.hasOwnProperty( d.vote ) ) {
                    voteRunningTotals[ d.vote ] = 0;
                }
                voteRunningTotals[ d.vote ] += 1;
                return yScale( voteRunningTotals[ d.vote ] );
            } );
        var svg = d3.select( location ).append( "svg" )
            .attr( "width", WIDTH + MARGIN.left + MARGIN.right)
            .attr( "height", HEIGHT + MARGIN.top + MARGIN.bottom)
            .attr( "transform", "translate(" + MARGIN.left + "," + MARGIN.top + ")" );
        svg.append( "g" ).call( xAxis )
            .attr( "class", "x axis" )
            .attr( "transform", "translate(0," + HEIGHT + ")" );
        svg.append( "g" ).call( yAxis )
            .attr( "class", "y axis" )
            .attr( "transform", "translate(0,0)" );
        for ( var voteType in voteTotals ) {
            var specificVotes = [];
            for ( var key in voteObjects ) {
                if ( voteObjects[ key ].vote === voteType ) {
                    specificVotes.push( voteObjects[ key ] );
                }
            }
            svg.append( "path" )
                .datum( specificVotes )
                .attr( "d", line )
                .attr( "class", "line " + voteType.toLowerCase() )
                .attr( "vote-type", voteType );
            svg.append( "text" )
                .attr( "x", xScale( specificVotes.slice( -1 )[0].time ) )
                .attr( "y", yScale( voteTotals[ voteType ] ) )
                .text( voteType )
                .attr( "class", voteType.toLowerCase().substr( 0, 10 ) );
        }
    }

    // This version uses background colors
    function appendSupportPercentageGraphTo ( location, voteObjects ) {
        const WIDTH = 650, HEIGHT = 250, MARGIN = { top: 15, bottom: 35, left: 50, right: 100 };
        var xScale = d3.time.scale()
            .range( [ 0, WIDTH ] )
            .domain( d3.extent( voteObjects, function ( d ) { return d.time; } ) );
        var earliestVoteTime = xScale.domain()[ 0 ];

        // Calculate the highest and lowest percentages reached, for the y-scale
        var runningSupports = 0,
            runningOpposes = 0;
        var percentages = [];
        for(var i = 0; i < voteObjects.length; i++) {
            if( voteObjects[i].vote === "Support" ) runningSupports++;
            if( voteObjects[i].vote === "Oppose" ) runningOpposes++;
            percentages.push( {
                "time": voteObjects[i].time,
                "percentage": runningSupports / ( runningSupports + runningOpposes )
            } );
        }
        var yExtent = d3.extent( percentages, function ( d ) { return d.percentage; } )
        var yScale = d3.scale.linear()
            .range( [ HEIGHT, 0 ] )
            .domain( yExtent );

        var xAxis = d3.svg.axis()
            .scale( xScale )
            .orient( "bottom" );
        var yAxis = d3.svg.axis()
            .tickFormat( function ( tickData ) { return Math.floor(tickData * 100) + "%"; } )
            .scale( yScale )
            .orient( "left" );
        var voteRunningTotals = {};
        var line = d3.svg.line()
            .x( function ( d ) { return xScale( d.time ); } )
            .y( function ( d ) { return yScale( d.percentage ); } );
        var svg = d3.select( location ).append( "svg" )
            .attr( "class", "support" )
            .attr( "width", WIDTH + MARGIN.left + MARGIN.right)
            .attr( "height", HEIGHT + MARGIN.top + MARGIN.bottom)
            .attr( "transform", "translate(" + MARGIN.left + "," + MARGIN.top + ")" );

        // Background color
        var backgroundRectHeight = HEIGHT/((yExtent[1] - yExtent[0])*100);
        for( var i = Math.floor(yExtent[0]*100)+1; i <= Math.floor(yExtent[1]*100); i++ ) {
            svg.append( "rect" )
                .attr( "class", "background" )
                .style( "fill", "#" + window.SUPPORT_PERCENTAGE_COLOR_CODES[i] )
                .attr( "x", 0 )
                .attr( "y", yScale( i/100 ) )
                .attr( "width", WIDTH )
                .attr( "height", backgroundRectHeight );
        }

        // Clip out the background color for the x-axis
        svg.append( "rect" )
            .style( "fill", "white" )
            .attr( "x", 0 )
            .attr( "y", HEIGHT )
            .attr( "width", WIDTH )
            .attr( "height", MARGIN.bottom );

        // Axes
        svg.append( "g" ).call( xAxis )
            .attr( "class", "x axis" )
            .attr( "transform", "translate(0," + (HEIGHT) + ")" );
        svg.append( "g" ).call( yAxis )
            .attr( "class", "y axis" )
            .attr( "transform", "translate(0,0)" );

        // The data line
        svg.append( "path" )
            .datum( percentages )
            .attr( "d", line )
            .attr( "class", "line percentage" );
    }

    // This version colors the line in the line graph
    function appendSupportPercentageGraphToOld ( location, voteObjects ) {
        const WIDTH = 650, HEIGHT = 250, MARGIN = { top: 15, bottom: 35, left: 50, right: 100 };
        var xScale = d3.time.scale()
            .range( [ 0, WIDTH ] )
            .domain( d3.extent( voteObjects, function ( d ) { return d.time; } ) );
        var earliestVoteTime = xScale.domain()[ 0 ];

        // Calculate the highest and lowest percentages reached, for the y-scale
        var runningSupports = 0,
            runningOpposes = 0;
        var percentages = [];
        for( var i = 0; i < voteObjects.length; i++) {
            if( voteObjects[i].vote === "Support" ) runningSupports++;
            if( voteObjects[i].vote === "Oppose" ) runningOpposes++;
            percentages.push( {
                "time": voteObjects[i].time,
                "percentage": runningSupports / ( runningSupports + runningOpposes )
            } );
        }
        var yScale = d3.scale.linear()
            .range( [ HEIGHT, 0 ] )
            .domain( d3.extent( percentages, function ( d ) { return d.percentage; } ) );

        // We do some d3 magic to get the color-coding, so we need each data point with
        // x, y, x1, y1, x2, and y2 attributes instead of percentage and vote ones
        // Source: http://stackoverflow.com/a/27027550/1757964
        var svgPoints = percentages.map( function ( dataPoint, index ) {
            var nextPoint = percentages[index + 1],
                previousPoint = percentages[index - 1],
                thisX = xScale( dataPoint.time ),
                thisY = yScale( dataPoint.percentage );
            return {
                x: thisX,
                y: thisY,
                x1: thisX,
                y1: thisY,
                x2: xScale( nextPoint ? nextPoint.time : previousPoint.time ),
                y2: yScale( nextPoint ? nextPoint.percentage : previousPoint.percentage ),
                stroke: "#" + window.SUPPORT_PERCENTAGE_COLOR_CODES[ Math.round( dataPoint.percentage * 100 ) ]
            };
        } );

        var xAxis = d3.svg.axis()
            .scale( xScale )
            .orient( "bottom" );
        var yAxis = d3.svg.axis()
            .tickFormat( function ( tickData ) { return tickData * 100 + "%"; } )
            .scale( yScale )
            .orient( "left" );
        var voteRunningTotals = {};
        var line = d3.svg.line()
            .x( function ( d ) { return xScale( d.time ); } )
            .y( function ( d ) { return yScale( d.percentage ); } );
        var svg = d3.select( location ).append( "svg" )
            .attr( "class", "support" )
            .attr( "width", WIDTH + MARGIN.left + MARGIN.right)
            .attr( "height", HEIGHT + MARGIN.top + MARGIN.bottom)
            .attr( "transform", "translate(" + MARGIN.left + "," + MARGIN.top + ")" );
        svg.append( "g" ).call( xAxis )
            .attr( "class", "x axis" )
            .attr( "transform", "translate(0," + HEIGHT + ")" );
        svg.append( "g" ).call( yAxis )
            .attr( "class", "y axis" )
            .attr( "transform", "translate(0,0)" );
        svg.selectAll( "line" )
            .data( svgPoints )
            .enter()
            .append( "line" )
            .attr( 'x1', function( d ) { return d.x1; } )
            .attr( 'y1', function( d ) { return d.y1; } )
            .attr( 'x2', function( d ) { return d.x2; } )
            .attr( 'y2', function( d ) { return d.y2; } )
            .attr( 'stroke', function ( d ) { return d.stroke; } )
            .attr( "fill", "none" )
            .attr( "stroke-width", 2 );
    }

    // Bind form submission handler to submission button & page field
    $( "#submit" ).click( function () {
        listDiscussions();
    } );

    $( "#page" ).keyup( function ( e ) {
        if ( e.keyCode == 13 ) {

            // Enter was pressed in the username field
            listDiscussions();
        }
    } );

    // Allow user to be specified in hash in the form `#page=Example`
    if ( window.location.hash ) {
      $( "#page" ).val( decodeURIComponent( window.location.hash.replace( /^#page=/, "" ) ) );
      $( "#submit" ).trigger( "click" );
    }
} );

