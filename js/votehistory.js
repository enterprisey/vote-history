/* jshint moz: true */
$( document ).ready( function () {
    const API_ROOT = "https://en.wikipedia.org/w/api.php",
          API_SUFFIX = "&format=json&callback=?&continue=";

    var listDiscussions = function () {
        var pageTitle = $( "#page" ).val();
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
        $.getJSON( API_ROOT + "?action=query&prop=revisions&rvprop=content&format=jsonfm&titles=" + pageTitle + API_SUFFIX, function ( data ) {
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
            var sectionHeaders = pageText.match( /==+.+?==+/g );
            if ( VoteHistorySpecialCases.check( pageTitle ) ) {
                $( "#discussions" ).empty().append( $( "<div>" )
                                                    .addClass( "successbox" )
                                                    .text( "Special discussion page detected at " )
                                                    .append( $( "<a> " )
                                                             .attr( "href", "https://en.wikipedia.org/wiki/" + pageTitle )
                                                             .text( pageTitle ) ) );
                analyzeDiscussion( pageText );
            } else if(!sectionHeaders ) {
                $( "#discussions" ).hide();
                $( "#error" ).empty().show();
                $( "#error" ).append( $( "<div>" )
                                      .addClass( "errorbox" )
                                      .text( "I couldn't find any discussion headers on the page." ) );
                return;
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
                    $( "#discussions" ).append( $( "<div>" )
                                                .addClass( "discussion" )
                                                .append( $( "<button>" )
                                                         .addClass( "mw-ui-button mw-ui-progressive" )
                                                         .addClass( "vote-history-analyze-button" )
                                                         .text( "Analyze >>" )
                                                         .attr( disabledAttr )
                                                         .click( function ( e ) { analyzeDiscussion( section ); } ) )
                                                .append( $( "<b>" ).text( item.replace( /=/g, "" ) ) )
                                                .append( $( "<i>" ).text( ( !votes ? "No votes" : ( votes.length + " votes" ) ) +
                                                                          "; " + section.length + " bytes" ) ) );
                } );
            }
        } );
    }; // end listDiscussions()

    var getVotes = function ( voteText ) {
        voteText = voteText.replace( /=.+?=/, "" ).replace( /#/, "*" );
        return voteText.match( /\*\s*'''.+?'''[\s\S]*?\d\d:\d\d,\s\d\d\s\w+?\s\d\d\d\d\s\(UTC\)/g );
    }

    var analyzeDiscussion = function ( discussionText ) {
        $( "#analysis" )
            .show()
            .empty()
            .append( $( "<h2>" ).text( "Analysis of discussion" ) );

        var votes = getVotes( discussionText );
        if ( !votes ) {
            $( "#analysis" ).append( $( "<div>" )
                                     .addClass( "errorbox" )
                                     .text( "No votes found." ) );
            return;
        }

        $( "#analysis" ).append( $( "<ul>" ) );
        var voteObjects = [];
        votes.forEach( function ( voteText ) {
            var vote = voteText.match( /'''.+?'''/ )[0].replace( /'''/g, "" ),
                timestamp = voteText.match( /\d\d:\d\d,\s\d\d\s\w+\s\d\d\d\d\s\(UTC\)/ )[0];
            vote = vote.replace( /Obvious/, "" ).replace( /Speedy/, "" ).trim();
            vote = vote.charAt( 0 ).toUpperCase() + vote.substr( 1 ).toLowerCase();
            console.log(vote);
            var voteObject = { "vote": vote, "time": Date.parse( timestamp ) };
            voteObjects.push( voteObject );
        } );
        voteObjects.sort( function ( a, b ) { return a.time - b.time; } );
        appendVoteGraphTo( "#analysis", voteObjects );
        voteObjects.forEach( function ( voteObject ) {
            $( "#analysis ul" ).append( $( "<li>" ).text( voteObject.vote + ", cast on " +
                                                          moment( voteObject.time ).format( "D MMMM YYYY" ) ) );
        } );

        if( $( "#analysis" ).offset().top > $( window ).scrollTop + $( window ).height ) {
            window.scrollTo( 0, $( "#analysis" ).offset().top );
        }
    }

    var appendVoteGraphTo = function ( location, voteObjects ) {
        const WIDTH = 900, HEIGHT = 250, MARGIN = { top: 25, bottom: 25, left: 50, right: 25 };
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
        }
    }

    // Bind form submission handler to submission button & page field
    $( "#submit" ).click( function () {
        listDiscussions();
    } );
    $( "#page" ).keyup( function ( e ) {
        // Update hash
        window.location.hash = '#page=' + encodeURIComponent($(this).val());

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
