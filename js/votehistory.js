/* jshint moz: true */
$( document ).ready( function () {
    const API_ROOT = "https://en.wikipedia.org/w/api.php",
          API_SUFFIX = "&format=json&callback=?&continue=";

    var listDiscussions = function () {
        var page = $( "#page" ).val();
        $( "#error" ).hide();
        $( "#discussions" ).hide();
        $( "#analysis" ).hide();
        if ( page === "" ) {
            $( "#error" ).empty();
            $( "#error" ).show();
            $( "#error" ).append( $( "<div>" )
                               .addClass( "errorbox" )
                               .text( "No page specified." ) );
            return;
        }

        $( "#discussions" ).show();
        $( "#discussions" ).text( "Loading..." );
        $.getJSON( API_ROOT + "?action=query&prop=revisions&rvprop=content&format=jsonfm&titles=" + page + API_SUFFIX, function ( data ) {
            try {
                var pageid = Object.getOwnPropertyNames( data.query.pages )[0];
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
            $( "#discussions" ).append( $( "<h2>" ).text( "Discussions on " )
                                        .append( $( "<a> " )
                                                 .attr( "href", "https://en.wikipedia.org/wiki/" + page )
                                                 .text( page ) ) );
            var sectionHeaders = pageText.match( /==[^=]+==/g ),
                xfd = pageText.match( /===/g ) && pageText.match( /===/g ).length == 2;
            if ( xfd || !sectionHeaders ) {
                if ( new RegExp( "'''" ).test( pageText ) ) {
                    $( "#discussions" ).empty().append( $( "<div>" )
                                                .addClass( "warningbox" )
                                                .text( "Detected entire page to be one discussion" ) );
                    analyzeDiscussion( pageText );
                    return;
                } else {
                    $( "#discussions" ).hide();
                    $( "#error" ).empty().show();
                    $( "#error" ).append( $( "<div>" )
                                          .addClass( "errorbox" )
                                          .text( "I couldn't find any discussion headers on the page." ) );
                    return;
                }
            }
            sectionHeaders.forEach( function ( item, index ) {
                var trailerRegex = ( index == sectionHeaders.length - 1 ) ? "" : "?==",
                    regex = item + "\n(\n|.)*" + trailerRegex;
                var section = pageText.match( new RegExp( regex, "g" ) );
                if ( !section ) return;
                section = section[0];

                var votes = section.getVotes();
                var disabledAttr = votes ? {} : { "disabled": "disabled" };
                $( "#discussions" ).append( $( "<div>" )
                                            .addClass( "discussion" )
                                            .append( $( "<button>" )
                                                     .addClass( "mw-ui-button mw-ui-progressive" )
                                                     .addClass( "vote-history-analyze-button" )
                                                     .text( "Analyze >>" )
                                                     .attr( disabledAttr )
                                                     .click( function ( e ) { analyzeDiscussion( section ); } ) )
                                            .append( $( "<b>" ).text( item.substring( 2, item.length - 2 ) ) )
                                            .append( $( "<i>" ).text( !votes ? "(no votes)" : ( votes.length + " votes" ) ) ) );
            } );
        } );
    }; // end listDiscussions()

    String.prototype.getVotes = function () {
        return this.match( /\*\s*'''.+?'''[\s\S]*?\d\d:\d\d,\s\d\d\s\w+?\s\d\d\d\d\s\(UTC\)/g );
    }

    var analyzeDiscussion = function ( discussionText ) {
        $( "#analysis" )
            .show()
            .empty()
            .append( $( "<h2>" ).text( "Analysis of discussion" ) );

        var votes = discussionText.getVotes();
        if ( !votes ) {
            $( "#analysis" ).append( $( "<div>" )
                                     .addClass( "errorbox" )
                                     .text( "No votes found." ) );
            return;
        }
        //$( "#analysis" ).append(votes);

        $( "#analysis" ).append( $( "<ul>" ) );
        var voteObjects = [];
        votes.forEach( function ( voteText ) {
            var vote = voteText.match( /'''.+?'''/ )[0].replace( /'''/g, "" ),
                timestamp = voteText.match( /\d\d:\d\d,\s\d\d\s\w+\s\d\d\d\d\s\(UTC\)/ )[0],
                voteObject = { "vote": vote, "time": Date.parse( timestamp ) };
            voteObjects.push( voteObject );
        } );
        voteObjects.sort( function ( a, b ) { return a.time - b.time; } );
        voteObjects.forEach( function ( voteObject ) {
            $( "#analysis ul" ).append( $( "<li>" ).text( voteObject.vote + ", cast on " + moment( voteObject.time ).format( "D MMMM YYYY" ) ) );
        } );
        window.scrollTo( 0, $( "#analysis" ).offset().top );
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
