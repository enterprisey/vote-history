var VoteHistorySpecialCases = {
    functions: {
        "Wikipedia:Articles for deletion/": function ( pageText ) {

            // Everything after the timestamp of the nom statement.
            return pageText
                .match( /\d\d:\d\d,\s\d\d\s\w+\s\d\d\d\d\s\(UTC\)[\S\s]+/ )
                .replace( /\d\d:\d\d,\s\d\d\s\w+\s\d\d\d\d\s\(UTC\)/, "" );
        },
        "Wikipedia:Templates for discussion/Log/": this.tfd,
        "Wikipedia:Categories for discussion/Log/": this.cfd,
        "Wikipeda:Redirects for discussion/Log/": this.rfd,
        "Wikipedia:Miscellany for deletion": this.mfd,
        "Wikipedia:Requests for adminship/": function ( pageText ) {
            if ( pageText.match( /=====Support=====/ ) ) {
                var result = pageText
                    .match( /=====Support=====[\S\s]+/ )[0]
                    .replace( /=====Support=====/, "" )
                    .replace( /=====Oppose=====/, "" )
                    .replace( /=====Neutral=====/, "" );
                return result;
            } else {
                var result = pageText
                    .match( /====Discussion====[\S\s]+/ )[ 0 ]
                    .replace( /====Discussion====/, "" );
                return result;
            }
        },
        "Wikipedia:Requests for bureaucratship/": this.rfb
    },
    getFunction: function ( title ) {

        // Get relevant special-case function
        var result = undefined;
        Object.keys( this.functions ).forEach( function ( prefix ) {
            if ( title.startsWith( prefix ) ) {
                result = this.functions[ prefix ];
            }
        }, this );
        return result;
    },
    check: function ( title ) {

        // Do I have a function for this sort of page?
        return !!this.getFunction( title );
    }
}
