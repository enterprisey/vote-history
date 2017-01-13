// Why is this in its own file? So we can test everything else with Mocha.
document.addEventListener( "DOMContentLoaded", function () {

    // Bind form submission handler to submission button & page field
    $( "#submit" ).click( function () {
        listDiscussions();
    } );

    $( "#page" ).keyup( function ( e ) {
        if ( e.keyCode == 13 ) {

            // Enter was released in the username field
            $( "#submit" ).trigger( "click" );
        }
    } );

    if ( window.location.hash && window.location.hash.indexOf( "#page=" ) >= 0 ) {

        // In the past, we let the hash specify the user, like #page=Example
        $( "#page" ).val( decodeURIComponent( window.location.hash.replace( /^#page=/, "" ) ) );
        $( "#submit" ).trigger( "click" );
    } else if( window.location.search.substring( 1 ).indexOf( "page=" ) >= 0 ) {

        // Allow the user to be specified in the query string, like ?page=Example
        var pageArgMatch = /&?page=([^&#]*)/.exec( window.location.search.substring( 1 ) );
        if( pageArgMatch && pageArgMatch[1] ) {
            $( "#page" ).val( decodeURIComponent( pageArgMatch[1].replace( /\+/g, " " ) ) );
            $( "#submit" ).trigger( "click" );
        }
    } else {

        // Show some suggestions
        $( "#suggestions" )
            .hide()
            .append( "Suggestions: " );
        getPageText( "Wikipedia:Requests for adminship/Recent" ).done( function ( pageText ) {
            var mostRecentRfAs = pageText.match(/{{[Rr]ecent RfX\|A\|([^|]+)/g).slice(0, 2).map( function ( matchText ) {
                return "WP:Requests for adminship/" + matchText.replace( /{{[Rr]ecent RfX\|A\|/, "" );
            } );
            ( mostRecentRfAs.concat( [ "Wikipedia:Village pump (proposals)" ] ) ).forEach( function ( pageName ) {
                $( "#suggestions" )
                    .append( $( "<a>" )
                             .attr( "href", "#" )
                             .text( pageName )
                             .click( function () {
                                 $( "#page" ).val( pageName );
                                 $( "#submit" ).trigger( "click" );
                             } ) );
            } );
            $( "#suggestions" ).fadeIn();
        } );
    }
} );
