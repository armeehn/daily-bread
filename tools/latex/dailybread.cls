%% dailybread.cls — one A5 page per \begin{page}, typeset from the same
%% semantic macros tools/latex/dblatex/reader.py parses for the web.
%%
%% Built on riposte-latex (RL-BRAND-001): colours, rules, chips. Daily Bread's
%% palette IS the Riposte palette (pink/marigold/teal on ink and bone), so the
%% brand package is loaded for everything but the face: the magazine's face is
%% IBM Plex Mono, riposte's is JetBrains Mono, so the font is set here.
%% Without riposte.sty on TEXINPUTS a minimal shim keeps the class compiling;
%% the geometry checks in CI do not depend on the brand layer.
%%
%% MACRO SET (the reader understands exactly this; anything else is an error)
%%   \issue{} \theme{} \edition{} \trim{}          issue metadata
%%   \begin{page}{id}{Template}[variant] … \end{page}
%%   \slug{}  \chrome{key}{value}                  page identity + running chrome
%%   \field{name}{value}                           any string prop
%%   \headline{} \kicker{} \standfirst{} \byline{} \pullquote{}
%%                                                 sugar for title/kicker/dek/byline/quote
%%   \begin{seq}{name} \block{…} … \end{seq}      a block sequence
%%   \begin{body} … \end{body}                     sugar for seq{body}
%%
%% Values are stored, not typeset, until \end{page}; the template renderer
%% then lays them out. Every page is one fixed-height box, so the page count
%% equals the number of \begin{page}s no matter what the content does.
%%
%% THE LOOK — the page furniture of the db-render/*.dc.html kit, redrawn in
%% TeX: running heads over an accent rule, a doc number and folio over a
%% full-bleed footer strip (checkerboard for footer=mono, pink/teal diamonds
%% for footer=duo), ink-framed row tables with dashed rules and numbered
%% chips, dashed photo slots, accent-barred pull quotes, kiss-cut sticker
%% die-lines, and the blackletter brand face on the section brands. Body
%% copy is justified and hyphenated — the reason to typeset in TeX at all.
%%
%% CLASS OPTIONS
%%   fontpath=<dir/>   where JetBrains Mono lives for the brand layer
%%   dbfonts=<dir/>    where UnifrakturMaguntia + Caveat live (default dbfonts/,
%%                     a symlink press.py stages next to the build)
%%   showrest          also print, small, any prop a template did not place
\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{dailybread}[2026/09/08 v0.2 Daily Bread issue]

\RequirePackage{kvoptions}
\SetupKeyvalOptions{family=db,prefix=db@}
\DeclareStringOption[fonts/]{fontpath}
\DeclareStringOption[dbfonts/]{dbfonts}
\DeclareBoolOption{showrest}
\ProcessKeyvalOptions*
\LoadClass[10pt]{article}

\RequirePackage{etoolbox}
\RequirePackage{xstring}
\RequirePackage{xcolor}
\RequirePackage{graphicx}
\RequirePackage{tikz}
\usetikzlibrary{calc,patterns}
\RequirePackage[most]{tcolorbox}
\RequirePackage{ragged2e}
\RequirePackage{microtype}

% ---------------------------------------------------------------------------
% BRAND LAYER
% ---------------------------------------------------------------------------
\IfFileExists{riposte.sty}{%
  \edef\db@ripopts{field=bone,font=none,fontpath=\db@fontpath}%
  \expandafter\RequirePackage\expandafter[\db@ripopts]{riposte}%
}{%
  \ClassWarning{dailybread}{riposte.sty not found; brand layer shimmed}%
  \definecolor{RipInk}{HTML}{1D1A17}
  \definecolor{RipBone}{HTML}{F6F1E7}
  \definecolor{RipPink}{HTML}{F0477D}
  \definecolor{RipOrange}{HTML}{FE9A0D}
  \definecolor{RipTeal}{HTML}{12B795}
  \colorlet{RipText}{RipInk}
  \colorlet{RipTextMuted}{RipInk!65!RipBone}
  \colorlet{RipLine}{RipInk}
  \pagecolor{RipBone}\color{RipText}
  \newcommand{\riprule}{\par\noindent{\color{RipLine}\rule{\linewidth}{1.5pt}}\par}
  \newcommand{\ripdashrule}{\par\noindent{\color{RipTextMuted}\rule{\linewidth}{0.4pt}}\par}
}
\colorlet{DBPaper}{RipBone}
\colorlet{DBPad}{RipInk!6!RipBone}      % the pale fill of an empty slot
\colorlet{DBMuted}{RipInk!55!RipBone}

% The face. IBM Plex Mono by name (fontconfig), by file (TeX Live ships it),
% then the bundled JetBrains Mono, then whatever fontspec has.
\RequirePackage{fontspec}
\defaultfontfeatures{Ligatures=TeX}
% The kit's glyph set (◦ ▸ ✕ ✂ ☐) is not in Plex Mono; DejaVu Sans fills in.
\ifcsname directlua\endcsname
  \directlua{luaotfload.add_fallback("dbglyphs", {"DejaVu Sans:mode=harf;"})}
  \defaultfontfeatures{Ligatures=TeX, RawFeature={fallback=dbglyphs}}
\fi
\IfFontExistsTF{IBM Plex Mono}{\setmainfont{IBM Plex Mono}}{%
  \IfFontExistsTF{IBMPlexMono-Regular.otf}{%
    \setmainfont{IBMPlexMono}[Extension=.otf,UprightFont=*-Regular,BoldFont=*-Bold,
      ItalicFont=*-Italic,BoldItalicFont=*-BoldItalic]}{%
    \IfFileExists{\db@fontpath JetBrainsMono-Regular.ttf}{%
      \setmainfont{JetBrainsMono}[Path=\db@fontpath,Extension=.ttf,
        UprightFont=*-Regular,BoldFont=*-Bold,ItalicFont=*-Italic]}{%
      \ClassWarning{dailybread}{no monospace brand face found}}}}
\renewcommand{\familydefault}{\rmdefault}

% The two display faces of the kit: UnifrakturMaguntia for brands and the
% wordmark, Caveat for the hand-written sign-offs. Both OFL, in dbfonts/.
% Without them the brand falls back to bold mono and the scribble to italic.
\newif\ifdb@fraktur \newif\ifdb@script
\IfFileExists{\db@dbfonts UnifrakturMaguntia-Book.ttf}{%
  \newfontfamily\db@frakturface{UnifrakturMaguntia-Book.ttf}[Path=\db@dbfonts]\db@frakturtrue}{%
  \IfFileExists{\db@dbfonts UnifrakturMaguntia.ttf}{%
    \newfontfamily\db@frakturface{UnifrakturMaguntia.ttf}[Path=\db@dbfonts]\db@frakturtrue}{%
    \ClassWarning{dailybread}{UnifrakturMaguntia not in \db@dbfonts; brands set in bold mono}}}
\IfFileExists{\db@dbfonts Caveat[wght].ttf}{%
  \newfontfamily\db@scriptface{Caveat[wght].ttf}[Path=\db@dbfonts,RawFeature={axis={wght=600}}]\db@scripttrue}{%
  \ClassWarning{dailybread}{Caveat not in \db@dbfonts; sign-offs set in italic}}
\newcommand{\db@fraktur}{\ifdb@fraktur\db@frakturface\else\bfseries\fi}
\newcommand{\db@script}{\ifdb@script\db@scriptface\else\itshape\fi}

% ---------------------------------------------------------------------------
% GEOMETRY — A5 trim, the size every template is drawn at (db-render/*.dc.html
% at 561x794 px @ 96 dpi = 420 x 594.96 bp, which is what the press PDFs measure)
% The kit's safe inset is 26 px = 6.9 mm; the footer strip takes the bottom.
% ---------------------------------------------------------------------------
\newlength{\db@strip}\setlength{\db@strip}{6mm}
\RequirePackage[paperwidth=420bp,paperheight=594.96bp,
  top=7mm,bottom=13mm,inner=9mm,outer=7mm]{geometry}
\pagestyle{empty}
% The kit measures image heights in CSS px ("imgH": "250px"); 1px = 1/96 in.
\ifcsname pxdimen\endcsname\pxdimen=0.75bp\fi
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\setlength{\JustifyingParindent}{0pt}\setlength{\RaggedRightParindent}{0pt}
\raggedbottom
\hyphenpenalty=300 \tolerance=2000 \emergencystretch=2.5em \hbadness=5000
\microtypesetup{protrusion=true,expansion=false}

% Type ladder, tuned so the longest page (~3000 characters) fits one A5.
\newcommand{\db@xs}{\fontsize{6pt}{7.4pt}\selectfont}
\newcommand{\db@label}{\fontsize{6.6pt}{8pt}\selectfont\bfseries}
\newcommand{\db@bodysize}{\fontsize{8.8pt}{11.4pt}\selectfont}
\newcommand{\db@leadsize}{\fontsize{9.6pt}{12pt}\selectfont}
\newcommand{\db@hsize}{\fontsize{19pt}{20.5pt}\selectfont\bfseries}
\newcommand{\db@brandsize}{\fontsize{24pt}{25pt}\selectfont}
\newcommand{\db@wordmarksize}{\fontsize{34pt}{34pt}\selectfont}
\newlength{\db@gap}\setlength{\db@gap}{2.2mm}
\newcommand{\db@caps}[1]{\MakeUppercase{#1}}

% ---------------------------------------------------------------------------
% METADATA
% ---------------------------------------------------------------------------
\newcommand{\issue}[1]{\gdef\db@issue{#1}}
\newcommand{\theme}[1]{\gdef\db@theme{#1}}
\newcommand{\edition}[1]{\gdef\db@edition{#1}}
\newcommand{\trim}[1]{\gdef\db@trim{#1}}
\issue{}\theme{}\edition{}\trim{A5}

% ---------------------------------------------------------------------------
% STORAGE — props live in \db@p@<name>; a block sequence is \db@p@<name>@<i>
% with its count in \db@n@<name>. \db@names lists what was set so a page can
% be cleared and so \db@rest can print anything a template did not place.
% ---------------------------------------------------------------------------
\newcommand{\db@undef}[1]{\csundef{db@p@#1}\csundef{db@n@#1}}
\newcommand{\db@reset}{%
  \ifdef\db@names{\forlistloop{\db@undef}{\db@names}}{}%
  \gdef\db@names{}\gdef\db@done{}%
  \ifdef\db@cnames{\forlistloop{\db@cundef}{\db@cnames}}{}%
  \gdef\db@cnames{}\gdef\db@slug{}}
\newcommand{\db@cundef}[1]{\csundef{db@c@#1}}

\NewDocumentEnvironment{page}{m m O{}}
  {\db@reset\gdef\db@id{#1}\gdef\db@template{#2}\gdef\db@variant{#3}}
  {\db@emit}

\newcommand{\slug}[1]{\gdef\db@slug{#1}}
\newcommand{\chrome}[2]{\csgdef{db@c@#1}{#2}\listgadd\db@cnames{#1}}
\newcommand{\field}[2]{\csgdef{db@p@#1}{#2}\listgadd\db@names{#1}}
\newcommand{\headline}[1]{\field{title}{#1}}
\newcommand{\kicker}[1]{\field{kicker}{#1}}
\newcommand{\standfirst}[1]{\field{dek}{#1}}
\newcommand{\byline}[1]{\field{byline}{#1}}
\newcommand{\pullquote}[1]{\field{quote}{#1}}

\NewDocumentEnvironment{seq}{m}
  {\gdef\db@seqname{#1}\csnumgdef{db@n@#1}{0}\listgadd\db@names{#1}}{}
\NewDocumentEnvironment{body}{}{\begin{seq}{body}}{\end{seq}}
\newcommand{\block}[1]{%
  \csnumgdef{db@n@\db@seqname}{\csuse{db@n@\db@seqname}+1}%
  \csgdef{db@p@\db@seqname @\csuse{db@n@\db@seqname}}{#1}}

% ---------------------------------------------------------------------------
% RENDER HELPERS
% ---------------------------------------------------------------------------
% Run #2 once per value of prop #1 with the value in \db@item; a string is
% one value, a block sequence is each block. "none" and "" render nothing.
\newcommand{\db@each}[2]{%
  \ifcsdef{db@n@#1}{%
    \def\db@i{0}%
    \loop\ifnum\db@i<\csuse{db@n@#1}\relax
      \numdef\db@i{\db@i+1}%
      \letcs\db@item{db@p@#1@\db@i}%
      #2%
    \repeat
  }{%
    \letcs\db@item{db@p@#1}%
    \ifdefstring{\db@item}{none}{}{\ifdefempty{\db@item}{}{#2}}%
  }}
% Is prop #1 set to something visible? -> #2, else #3
\newcommand{\db@ifvis}[3]{%
  \ifcsdef{db@n@#1}{#2}{%
    \ifcsdef{db@p@#1}{%
      \letcs\db@tmpv{db@p@#1}%
      \ifdefstring{\db@tmpv}{none}{#3}{\ifdefempty{\db@tmpv}{#3}{#2}}}{#3}}}
\newcommand{\db@val}[1]{\ifcsdef{db@p@#1}{\csuse{db@p@#1}}{}}

% \db@r{kind}{name}: render prop `name` as `kind` if it was set.
\newcommand{\db@r}[2]{%
  \ifboolexpr{test {\ifcsdef{db@p@#2}} or test {\ifcsdef{db@n@#2}}}%
    {\listgadd\db@done{#2}\csuse{db@k@#1}{#2}}{}}
\newcommand{\db@skip}[1]{\listgadd\db@done{#1}}

% Split a row "a | b | c | #hex" into \db@fa (first field), \db@fb (the middle
% fields joined " · "), \db@ftail (the last field when there are three or
% more) and DBRow (the #hex, else the page accent). \db@nf = field count.
\newcommand{\db@tidy}[1]{% strip one leading / trailing space from macro #1
  \expandarg\IfBeginWith{#1}{ }{\StrGobbleLeft{#1}{1}[#1]}{}%
  \expandarg\IfEndWith{#1}{ }{\StrGobbleRight{#1}{1}[#1]}{}}
\newcommand{\db@lastof}[1]{% #1 macro: -> \db@last, \db@head (before it), \db@nb
  \expandarg\StrCount{#1}{|}[\db@nb]%
  \ifnum\db@nb>0
    \expandarg\StrBehind[\db@nb]{#1}{|}[\db@last]\expandarg\StrBefore[\db@nb]{#1}{|}[\db@head]%
  \else\let\db@last#1\def\db@head{}\fi}
\newcommand{\db@hexcolor}[2]{% #1 colour name, #2 macro holding "\#rrggbb"
  \expandarg\StrRight{#2}{6}[\db@hex]%
  \uppercase\expandafter{\expandafter\def\expandafter\db@hex\expandafter{\db@hex}}%
  \edef\db@tmp{\noexpand\definecolor{#1}{HTML}{\db@hex}}\db@tmp}
% Is macro #1 a "\#rrggbb" and nothing else? -> #2, else #3. ("bring \#2 + \#5"
% contains a hash and is prose.)
\newcommand{\db@ifhex}[3]{%
  \expandarg\StrLen{#1}[\db@ll]%
  \expandarg\IfBeginWith{#1}{\#}{\ifnum\db@ll=7 #2\else #3\fi}{#3}}
\newcommand{\db@fields}{%
  \colorlet{DBRow}{DBAccent}\def\db@ftail{}%
  \expandarg\StrCount{\db@item}{|}[\db@nf]\numdef\db@nf{\db@nf+1}%
  \expandarg\IfSubStr{\db@item}{|}{%
    \expandarg\StrCut{\db@item}{|}{\db@fa}{\db@fb}\db@tidy\db@fa
    \db@lastof\db@fb\db@tidy\db@last
    \db@ifhex{\db@last}{\db@hexcolor{DBRow}{\db@last}\let\db@fb\db@head\numdef\db@nf{\db@nf-1}\db@lastof\db@fb\db@tidy\db@last}{}%
    \ifnum\db@nb>0 \let\db@ftail\db@last\let\db@fb\db@head\fi
    \expandarg\StrSubstitute{\db@fb}{|}{ · }[\db@fb]\db@tidy\db@fb
  }{\let\db@fa\db@item\def\db@fb{}}}

% A chip: bone text on a coloured pad.
\newcommand{\db@chip}[2]{% #1 colour, #2 text
  \tikz[baseline=(c.base)]\node[fill=#1,text=DBPaper,inner xsep=1.4pt,inner ysep=1pt,font=\db@xs\bfseries](c){\db@caps{#2}};}
% A stamp: rotated, bordered, accent-coloured.
\newcommand{\db@stampbox}[1]{%
  \rotatebox{-3}{\tikz\node[draw=RipOrange,line width=1.2pt,text=RipOrange,inner sep=2.4pt,font=\db@label]{\db@caps{#1}};}}
% Dashed rule between rows.
\newcommand{\db@dash}{\par\noindent\tikz\draw[DBMuted,dash pattern=on 1pt off 1.2pt,line width=0.4pt](0,0)--(\linewidth,0);\par}
% The ink frame every row table and card sits in.
\newtcolorbox{db@frame}[1][]{enhanced,sharp corners,boxrule=1.2pt,colframe=RipInk,
  colback=DBPaper,left=1.6mm,right=1.6mm,top=1.4mm,bottom=1.2mm,boxsep=0pt,
  before skip=0.6\db@gap,after skip=0.8\db@gap,#1}
% A framed box whose title is a chip bar.
\newcommand{\db@bar}[2]{% #1 left, #2 right (may be empty)
  {\db@label\db@caps{#1}\hfill{\color{DBAccent}\db@caps{#2}}\par}\vspace{0.4mm}\riprule\vspace{0.6mm}}
% A dashed photo/art slot of height #1 with label #2.
\newcommand{\db@slot}[2]{%
  \noindent\tikz{\node[draw=RipInk,dash pattern=on 2pt off 1.6pt,line width=0.7pt,fill=DBPad,
    minimum width=\linewidth,minimum height=#1,inner sep=2mm,text width=\dimexpr\linewidth-6mm,
    align=center,font=\db@xs\color{DBMuted}]{{\fontsize{11pt}{11pt}\selectfont ⊡}\\[2pt]#2};}\par}

% ---- kinds -----------------------------------------------------------------
\newcommand{\db@kindpara}[1]{{\db@bodysize\justifying\db@each{#1}{\db@item\par\vspace{0.5\db@gap}}}\vspace{0.3\db@gap}}
\newcommand{\db@kindnote}[1]{{\db@xs\color{DBMuted}\db@each{#1}{\db@caps{\db@item}\par}}\vspace{0.5\db@gap}}
\newcommand{\db@kindmeta}[1]{{\db@xs\db@each{#1}{\db@item\par}}\vspace{0.3\db@gap}}
\newcommand{\db@kindlabel}[1]{{\db@label\color{DBMuted}\db@each{#1}{\db@caps{\db@item}\par}}\vspace{0.4\db@gap}}
\newcommand{\db@kindkicker}[1]{{\db@each{#1}{\db@chip{RipInk}{\db@item}\par}}\vspace{0.8\db@gap}}
\newcommand{\db@kindtagbar}[2]{% accent bar: #1 left prop, #2 right prop
  \noindent\colorbox{DBAccent}{\parbox{\dimexpr\linewidth-2\fboxsep}{\db@label\color{DBPaper}%
    \db@caps{\db@val{#1}}\hfill\db@caps{\db@val{#2}}}}\par\vspace{\db@gap}}
\newcommand{\db@kindhead}[1]{{\db@hsize\RaggedRight\db@each{#1}{\db@caps{\db@item}\par}}\vspace{0.8\db@gap}}
\newcommand{\db@kindbrand}[1]{{\db@brandsize\db@fraktur\db@each{#1}{\db@item\par}}\vspace{0.6\db@gap}}
\newcommand{\db@kindwordmark}[1]{{\db@wordmarksize\db@fraktur\db@each{#1}{\db@item\par}}\vspace{\db@gap}}
\newcommand{\db@kindlead}[1]{{\db@leadsize\RaggedRight\db@each{#1}{\db@item\par}}\vspace{\db@gap}}
\newcommand{\db@kindrows}[1]{% framed rows: chip · text · muted right label
  \begin{db@frame}{\db@bodysize\db@each{#1}{\db@fields
    \noindent\ifdefempty{\db@ftail}{{\bfseries\db@fa}\ifdefempty{\db@fb}{}{\ · \db@fb}}%
      {\db@chip{DBRow}{\db@fa}\ \db@fb\hfill{\db@xs\color{DBMuted}\db@caps{\db@ftail}}}\par\db@dash}}\end{db@frame}}
\newcommand{\db@kindtable}[1]{% ENTRY | text | STATUS | #hex — three-column ledger
  \begin{db@frame}{\db@xs\bfseries\db@caps{\db@val{colA}}\hfill\db@caps{\db@val{colB}}\par}\vspace{0.4mm}\riprule\vspace{0.4mm}
   {\db@bodysize\db@each{#1}{\db@fields
    \noindent\parbox[t]{9mm}{\bfseries\db@fa}\parbox[t]{\dimexpr\linewidth-9mm-16mm}{\RaggedRight\db@fb}%
    \hfill\parbox[t]{15mm}{\raggedleft\db@chip{DBRow}{\db@ftail}}\par\db@dash}}\end{db@frame}}
\newcommand{\db@kindcards}[1]{% NAME | verdict | #hex | copy | tag — one framed card each
  {\db@bodysize\db@each{#1}{%
    \expandarg\StrCut{\db@item}{|}{\db@ca}{\db@crest}\db@tidy\db@ca
    \expandarg\StrCut{\db@crest}{|}{\db@cb}{\db@crest}\db@tidy\db@cb
    \expandarg\StrCut{\db@crest}{|}{\db@cc}{\db@crest}\db@tidy\db@cc
    \expandarg\StrCut{\db@crest}{|}{\db@cd}{\db@ce}\db@tidy\db@cd\db@tidy\db@ce
    \expandarg\IfSubStr{\db@cc}{\#}{\db@hexcolor{DBRow}{\db@cc}}{\colorlet{DBRow}{DBAccent}}%
    \begin{db@frame}[before skip=0.3\db@gap,after skip=0.3\db@gap]%
      {\db@label\db@caps{\db@ca}\hfill{\color{DBRow}\db@caps{\db@cb}}\par}\vspace{0.4mm}\ripdashrule\vspace{0.5mm}%
      {\db@bodysize\justifying\db@cd\ifdefempty{\db@ce}{}{\hfill{\db@xs\color{DBMuted}\db@caps{\db@ce}}}\par}%
    \end{db@frame}}}}
\newcommand{\db@kindquote}[1]{%
  {\db@leadsize\bfseries\itshape\db@each{#1}{%
    \noindent\begin{tikzpicture}\node[anchor=west,text width=\dimexpr\linewidth-4mm,inner sep=0pt,font=\db@leadsize\bfseries\itshape](q)at(3mm,0){\RaggedRight\db@item};
      \fill[DBAccent]($(q.north west)+(-2.6mm,0)$)rectangle($(q.south west)+(-1.6mm,0)$);\end{tikzpicture}\par\vspace{0.7\db@gap}}}}
\newcommand{\db@kindlines}[1]{% poem: "Title | line / line": title in brand face, " / " breaks
  {\db@each{#1}{\db@fields
    {\db@brandsize\db@fraktur\db@fa\par}\vspace{0.4\db@gap}%
    {\db@bodysize\expandarg\StrSubstitute{\db@fb}{ / }{\\}[\db@tmp]\RaggedRight\db@tmp\par}\vspace{1.4\db@gap}}}}
\newcommand{\db@kindqa}[1]{% "Q: …" as a chip + bold, "A: …" plain
  {\db@bodysize\justifying\db@each{#1}{%
    \expandarg\IfBeginWith{\db@item}{Q:}{%
      \StrGobbleLeft{\db@item}{2}[\db@tmp]\noindent\db@chip{DBAccent}{\db@val{qLabel}}\ {\bfseries\db@tmp}\par\vspace{0.3\db@gap}}{%
      \IfBeginWith{\db@item}{A:}{\StrGobbleLeft{\db@item}{2}[\db@tmp]\noindent\db@chip{RipInk}{\db@val{aLabel}}\ \db@tmp\par\vspace{0.7\db@gap}}{\db@item\par\vspace{0.5\db@gap}}}}}}
\newcommand{\db@kindadvice}[1]{% "question — SIGNED || answer"
  {\db@bodysize\justifying\db@each{#1}{%
    \expandarg\IfSubStr{\db@item}{||}{\StrCut{\db@item}{||}{\db@qq}{\db@aa}}{\let\db@qq\db@item\def\db@aa{}}%
    \begin{db@frame}[before skip=0.3\db@gap,after skip=0.4\db@gap]{\bfseries\db@qq\par}\end{db@frame}%
    \ifdefempty{\db@aa}{}{\noindent\db@chip{DBAccent}{A}\ \db@aa\par\vspace{0.8\db@gap}}}}}
\newcommand{\db@kindcheck}[1]{{\db@bodysize\db@each{#1}{\noindent{\color{DBAccent}☐}\ \db@item\par\db@dash}}\vspace{0.5\db@gap}}
\newlength{\db@pw}
\newcommand{\db@kindpanels}[1]{% comic panels: hatched frames in a two-up grid
  \setlength{\db@pw}{\dimexpr0.5\linewidth-1mm\relax}%
  {\def\db@pn{0}\db@each{#1}{\numdef\db@pn{\db@pn+1}%
    \expandarg\IfSubStr{\db@item}{—}{\expandarg\StrCut{\db@item}{—}{\db@pl}{\db@pt}\db@tidy\db@pl\db@tidy\db@pt}{\def\db@pl{}\let\db@pt\db@item}%
    \noindent\begin{tikzpicture}
      \path[draw=RipInk,line width=0.9pt,pattern=north east lines,pattern color=DBMuted!35](0,0)rectangle(\db@pw,24mm);
      \node[anchor=north west,fill=RipInk,text=DBPaper,font=\db@xs\bfseries,inner sep=1.2pt]at(0,24mm){\db@caps{\db@pl}};
      \node[anchor=north west,text width=\dimexpr\db@pw-3.2mm,font=\db@xs,inner sep=1.6mm,fill=DBPaper,fill opacity=0.85,text opacity=1]at(0,20.5mm){\db@pt};
    \end{tikzpicture}%
    \ifodd\db@pn\hfill\else\par\vspace{1.6mm}\fi}}\par\vspace{0.6\db@gap}}
\newcommand{\db@kindstamp}[1]{{\db@each{#1}{\db@stampbox{\db@item}\par}}\vspace{1.2\db@gap}}
\newcommand{\db@kindart}[1]{{\db@each{#1}{\db@slot{58mm}{\db@item}}}\vspace{0.6\db@gap}}
\newcommand{\db@kindarttall}[1]{% a slot as tall as the kit's imgH, else 40mm
  \db@ifvis{imgH}{\edef\db@ih{\db@val{imgH}}}{\def\db@ih{40mm}}%
  {\db@each{#1}{\db@slot{\db@ih}{\db@item}}}\vspace{0.6\db@gap}}
\newcommand{\db@kindphoto}[1]{% one of four slots sharing the width
  {\db@each{#1}{\tikz\node[draw=RipInk,dash pattern=on 2pt off 1.6pt,line width=0.7pt,fill=DBPad,
    minimum width=\dimexpr0.5\linewidth-1mm,minimum height=44mm,inner sep=1.5mm,
    text width=\dimexpr0.5\linewidth-5mm,align=center,font=\db@xs\color{DBMuted}]{⊡\\[1pt]\db@item};}}}
\newcommand{\db@kindsign}[1]{{\fontsize{12pt}{13pt}\selectfont\db@script\color{RipTeal}\db@each{#1}{\db@item\par}}\vspace{\db@gap}}
\newcommand{\db@kindstickers}[1]{% "TEXT | circle/square | bg | fg": kiss-cut, three across
  {\def\db@pn{0}\db@each{#1}{\numdef\db@pn{\db@pn+1}%
    \expandarg\StrCut{\db@item}{|}{\db@sa}{\db@srest}\db@tidy\db@sa
    \expandarg\StrCut{\db@srest}{|}{\db@sb}{\db@srest}\expandarg\StrDel{\db@sb}{ }[\db@sb]%
    \expandarg\StrCut{\db@srest}{|}{\db@sc}{\db@sd}\db@tidy\db@sc\db@tidy\db@sd
    \db@hexcolor{DBSbg}{\db@sc}\db@hexcolor{DBSfg}{\db@sd}%
    \begin{tikzpicture}
      \IfStrEq{\db@sb}{circle}{%
        \node[circle,fill=DBSbg,draw=RipInk,line width=0.6pt,minimum size=22mm,inner sep=1.5mm,text width=17mm,align=center,font=\db@xs\bfseries\color{DBSfg}](s){\db@caps{\db@sa}};
        \draw[DBMuted,dash pattern=on 1.2pt off 1pt,line width=0.4pt](s.center)circle(12.2mm);}{%
        \node[fill=DBSbg,draw=RipInk,line width=0.6pt,minimum size=22mm,inner sep=1.5mm,text width=17mm,align=center,font=\db@xs\bfseries\color{DBSfg}](s){\db@caps{\db@sa}};
        \draw[DBMuted,dash pattern=on 1.2pt off 1pt,line width=0.4pt]($(s.south west)+(-1.2mm,-1.2mm)$)rectangle($(s.north east)+(1.2mm,1.2mm)$);}
    \end{tikzpicture}%
    \ifnum\db@pn=3 \par\vspace{2.4mm}\def\db@pn{0}\else\hfill\fi}}\par}
\csdef{db@k@para}{\db@kindpara}
\csdef{db@k@text}{\db@kindpara}
\csdef{db@k@note}{\db@kindnote}
\csdef{db@k@meta}{\db@kindmeta}
\csdef{db@k@label}{\db@kindlabel}
\csdef{db@k@kicker}{\db@kindkicker}
\csdef{db@k@head}{\db@kindhead}
\csdef{db@k@brand}{\db@kindbrand}
\csdef{db@k@wordmark}{\db@kindwordmark}
\csdef{db@k@lead}{\db@kindlead}
\csdef{db@k@rows}{\db@kindrows}
\csdef{db@k@table}{\db@kindtable}
\csdef{db@k@cards}{\db@kindcards}
\csdef{db@k@quote}{\db@kindquote}
\csdef{db@k@lines}{\db@kindlines}
\csdef{db@k@qa}{\db@kindqa}
\csdef{db@k@advice}{\db@kindadvice}
\csdef{db@k@check}{\db@kindcheck}
\csdef{db@k@panels}{\db@kindpanels}
\csdef{db@k@stamp}{\db@kindstamp}
\csdef{db@k@art}{\db@kindart}
\csdef{db@k@arttall}{\db@kindarttall}
\csdef{db@k@photo}{\db@kindphoto}
\csdef{db@k@sign}{\db@kindsign}
\csdef{db@k@stickers}{\db@kindstickers}

% Anything a template did not place can still be printed, small, so nothing in
% the source is silently absent from paper (class option showrest). Off by
% default: the two-page bags (Letter, Contents, Interview, Lab, Colophon,
% Insert, Review, Listings) deliberately place half a bag per variant.
\newcommand{\db@restone}[1]{%
  \ifinlist{#1}{\db@done}{}{%
    {\db@xs\color{DBMuted}#1: }\db@kindmeta{#1}}}
\newcommand{\db@rest}{\ifdb@showrest\vspace{\db@gap}\ripdashrule\forlistloop{\db@restone}{\db@names}\fi}

% ---------------------------------------------------------------------------
% CHROME — running heads, accent rule, doc number, folio, footer strip
% ---------------------------------------------------------------------------
\newcommand{\db@c}[1]{\ifcsdef{db@c@#1}{\csuse{db@c@#1}}{}}
\newcommand{\db@setaccent}{%
  \ifcsdef{db@c@accent}{%
    \letcs\db@acc{db@c@accent}\expandarg\StrRight{\db@acc}{6}[\db@hex]%
    \uppercase\expandafter{\expandafter\def\expandafter\db@hex\expandafter{\db@hex}}%
    \edef\db@tmp{\noexpand\definecolor{DBAccent}{HTML}{\db@hex}}\db@tmp
  }{\colorlet{DBAccent}{RipPink}}}
\newcommand{\db@header}{%
  \ifcsdef{db@c@headLeft}{%
    {\db@xs\color{DBMuted}\db@caps{\db@c{headLeft}}\hfill\db@caps{\db@c{headRight}}\par}%
    \vspace{0.8mm}\noindent{\color{DBAccent}\rule{\linewidth}{1.5pt}}\par
    \vspace{\db@gap}}{}}
\newcommand{\db@footer}{%
  \ifcsdef{db@c@docNo}{%
    \vspace{\db@gap}{\db@xs\color{DBMuted}DOC NO. \db@c{docNo}\hfill\db@c{folio}\par}}{}}
% Full-bleed furniture is painted from the shipout background hook, whose
% picture origin is the sheet's top-left: \put(0,-\paperheight) makes (0,0)
% the bottom-left corner in every drawing below. One pass, no .aux round trip.
\gdef\db@bgpage{}
\AddToHook{shipout/background}{\put(0,-\paperheight){\db@bgpage}\global\let\db@bgpage\@empty}
\newcommand{\db@checker}[1]{% #1 = the square colour, over the paper
  \fill[DBPaper](0,0)rectangle(\paperwidth,\db@strip);
  \foreach \x in {0,1,...,34}{\foreach \y in {0,1}{%
    \pgfmathparse{int(mod(\x+\y,2))}\ifnum\pgfmathresult=0
      \fill[#1](\x*3mm,\y*3mm)rectangle++(3mm,3mm);\fi}}}
\newcommand{\db@diamonds}[1]{% #1 = y of the strip's bottom edge
  \fill[RipTeal](0,#1)rectangle(\paperwidth,#1+\db@strip);
  \foreach \x in {0,1,...,25}{%
    \fill[RipPink](\x*6mm,#1)--++(3mm,3mm)--++(3mm,-3mm)--cycle;
    \fill[RipPink](\x*6mm,#1+6mm)--++(3mm,-3mm)--++(3mm,3mm)--cycle;}}
% The strip: full-bleed, at the foot of the sheet. mono = ink/bone checker,
% duo = pink/teal diamonds. Pages with no docNo get none (art, covers).
\newcommand{\db@setstrip}{%
  \ifcsdef{db@c@docNo}{%
    \ifcsdef{db@c@footer}{\letcs\db@ft{db@c@footer}}{\def\db@ft{mono}}%
    \ifdefstring{\db@ft}{duo}%
      {\gdef\db@bgpage{\begin{tikzpicture}[overlay]\db@diamonds{0}\end{tikzpicture}}}%
      {\gdef\db@bgpage{\begin{tikzpicture}[overlay]\db@checker{RipInk}\end{tikzpicture}}}}{}}

% ---------------------------------------------------------------------------
% THE PAGE — one fixed-height box, then a fresh sheet. Content that does not
% fit runs past the box (an "Overfull \vbox" in the log, which `check`
% reports) but can never add a page.
% ---------------------------------------------------------------------------
\newcommand{\db@emit}{%
  \db@setaccent
  \ifdefstring{\db@template}{Cover}{\db@cover}{%
    \db@setstrip
    \noindent\begin{minipage}[b][\textheight][t]{\textwidth}%
      \RaggedRight
      \db@header
      \ifcsdef{db@t@\db@template}{\csuse{db@t@\db@template}}{\db@t@generic}%
      \db@rest
      \vfill
      \db@footer
    \end{minipage}}\clearpage}

% ---------------------------------------------------------------------------
% COVERS — full bleed, no chrome. Front: the art under the wordmark and an
% ink bar; back: the publisher's field of ink between a diamond strip and a
% checker strip. \dbassets (set by press.py) is where `art` paths resolve.
% ---------------------------------------------------------------------------
\providecommand{\dbassets}{}
\newcommand{\db@cover}{%
  \ifdefstring{\db@variant}{back}{\gdef\db@bgpage{\db@coverback}}{\gdef\db@bgpage{\db@coverfront}}%
  \mbox{}}
\newcommand{\db@wordmarktext}{\ifcsdef{db@p@wordmark}{\db@val{wordmark}}{Daily\\Bread}}
\newcommand{\db@coverfront}{%
  \begin{tikzpicture}[overlay]
    \letcs\db@art{db@p@art}%
    \IfFileExists{\dbassets\db@art}{%
      \node[anchor=south west,inner sep=0pt]at(0,0){\includegraphics[width=\paperwidth,height=\paperheight]{\dbassets\db@art}};}{%
      \fill[DBPad](0,0)rectangle(\paperwidth,\paperheight);
      \node[font=\db@xs\color{DBMuted},text width=60mm,align=center]at(0.5\paperwidth,0.5\paperheight){⊡\\cover art — \db@art};}
    \node[anchor=center,font=\db@fraktur\fontsize{56pt}{56pt}\selectfont,text=RipPink,align=center]at(0.5\paperwidth+0.7mm,0.5\paperheight-0.7mm){\db@wordmarktext};
    \node[anchor=center,font=\db@fraktur\fontsize{56pt}{56pt}\selectfont,text=RipInk,align=center]at(0.5\paperwidth,0.5\paperheight){\db@wordmarktext};
    \fill[RipInk](0,0)rectangle(\paperwidth,\db@strip);
    \node[anchor=west,font=\db@xs\bfseries,text=DBPaper]at(4mm,0.5\db@strip){\db@caps{\db@val{issueTag}}};
    \node[anchor=center,font=\db@xs\bfseries,text=DBPaper]at(0.5\paperwidth,0.5\db@strip){\db@caps{\db@val{price}}};
    \node[anchor=east,font=\db@xs\bfseries,text=DBPaper]at(\paperwidth-4mm,0.5\db@strip){\db@caps{\db@val{publisher}}};
  \end{tikzpicture}}
\newcommand{\db@coverback}{%
  \begin{tikzpicture}[overlay]
    \fill[RipInk](0,0)rectangle(\paperwidth,\paperheight);
    \db@diamonds{\paperheight-12mm}
    \fill[RipTeal](0,\paperheight-12mm)rectangle(\paperwidth,\paperheight-6mm);
    \foreach \x in {0,1,...,25}{\fill[RipPink](\x*6mm,\paperheight-12mm)--++(3mm,6mm)--++(3mm,-6mm)--cycle;}
    \node[anchor=center]at(0.5\paperwidth,0.5\paperheight+22mm){\includegraphics[width=52mm]{\dbassets../tools/latex/assets/logo-bone.pdf}};
    \node[anchor=center,font=\db@xs,text=DBPaper]at(0.5\paperwidth,0.5\paperheight+10mm){\db@caps{\db@val{publisherLong}}};
    \node[anchor=north,font=\db@bodysize,text=DBPaper,text width=62mm,align=center]at(0.5\paperwidth,0.5\paperheight+4mm){\db@val{tagline}};
    \begin{scope}[shift={(0.5\paperwidth-24mm,0.5\paperheight-24mm)}]
      \foreach \x in {0,0.6,...,26}{\pgfmathparse{int(mod(round(\x*7.3),3))}\ifnum\pgfmathresult=0\else\fill[DBPaper](\x mm,0)rectangle++(0.4mm,7mm);\fi}
      \node[anchor=west,font=\db@xs,text=DBPaper,align=left]at(29mm,3.5mm){\db@caps{\db@val{issn}}\\\db@caps{\db@val{edition}}};
    \end{scope}
    \db@checker{RipInk}
  \end{tikzpicture}}

% ---------------------------------------------------------------------------
% TEMPLATES — the order props are laid out, per template and variant. Shared
% content bags (Letter, Contents, Interview, Lab, Colophon, Insert, Review,
% Listings carry one bag across several pages) split by variant.
% ---------------------------------------------------------------------------
\csdef{db@t@generic}{%
  \db@r{kicker}{kicker}\db@r{head}{title}\db@r{lead}{dek}\db@r{meta}{byline}%
  \db@r{para}{body}}

\csdef{db@t@Letter}{%
  \ifdefstring{\db@variant}{masthead}{%
    \db@r{wordmark}{wordmark}\db@r{label}{subtitle}\db@r{stamp}{stamp}%
    \begin{db@frame}\db@bar{\db@val{mastheadLabel}}{}\db@skip{mastheadLabel}%
      {\db@bodysize\db@each{masthead}{\db@fields\noindent{\bfseries\db@caps{\db@fa}}\hfill\db@fb\par\db@dash}}\db@skip{masthead}\end{db@frame}%
    \db@r{para}{ack}\db@r{label}{funderLine}\db@r{note}{funderNote}%
  }{%
    \db@r{kicker}{kicker}\db@r{head}{title}%
    {\db@bodysize\justifying\db@ifvis{lead}{\noindent\db@chip{DBAccent}{\db@val{lead}}\ }{}%
      \db@each{body}{\db@item\par\vspace{0.6\db@gap}}}\db@skip{lead}\db@skip{body}%
    \vspace{0.6\db@gap}\db@r{sign}{signoff}\vfill\db@r{stamp}{stamp}}}

\csdef{db@t@Contents}{%
  \ifdefstring{\db@variant}{contributors}{%
    \db@r{kicker}{whoTag}\db@r{para}{whoBlurb}%
    \begin{db@frame}[colback=RipOrange!25!DBPaper]\db@bar{\db@val{subTitle}}{}\db@skip{subTitle}%
      {\db@bodysize\db@each{subRows}{\db@fields\noindent▸\ {\bfseries\db@fa}\ · \db@fb\par\db@dash}}\db@skip{subRows}\end{db@frame}%
    \vfill\db@r{note}{footNote}%
  }{%
    {\db@hsize\db@caps{\db@val{title}}{\color{DBAccent}.}\par}\vspace{0.8\db@gap}\db@skip{title}%
    \begin{db@frame}\db@bar{\db@val{manifestLabel}}{\db@val{manifestTag}}\db@skip{manifestLabel}\db@skip{manifestTag}%
      {\db@bodysize\def\db@pn{0}\db@each{rows}{\db@fields\numdef\db@pn{\db@pn+1}%
        \pgfmathparse{int(mod(\db@pn,4))}% the kit cycles the row chips through the palette
        \ifcase\pgfmathresult\colorlet{DBRow}{RipOrange}\or\colorlet{DBRow}{DBAccent}\or\colorlet{DBRow}{RipTeal}\else\colorlet{DBRow}{RipInk}\fi
        \noindent\db@chip{DBRow}{\db@fa}\ \db@fb\hfill{\db@xs\color{DBMuted}\db@caps{\db@ftail}}\par\db@dash}}\db@skip{rows}\end{db@frame}}}

\csdef{db@t@Feature}{%
  \ifdefstring{\db@variant}{text-cont}{%
    \db@r{para}{body}\vfill\db@r{note}{contNote}%
  }{%
    \db@r{kicker}{kicker}\db@r{head}{title}\db@r{lead}{dek}%
    \db@ifvis{byline}{{\db@label\color{DBAccent}\db@caps{\db@val{byline}}\par}\vspace{0.8\db@gap}}{}\db@skip{byline}%
    \ifdefstring{\db@variant}{opener}{%
      \db@ifvis{stats}{\begin{db@frame}{\db@each{stats}{\db@fields\noindent{\db@hsize\color{DBAccent}\db@fa}\ {\db@label\db@caps{\db@fb}}\par\db@dash}}\end{db@frame}}{%
        \db@r{art}{placeholder}\db@r{note}{caption}}%
      \db@r{para}{body}\vfill\db@r{note}{contNote}%
    }{%
      \db@r{para}{body}\vfill%
      \begin{db@frame}\db@bar{\db@val{boxTitle}}{}{\db@xs\db@val{boxBody}\par}\end{db@frame}}}}

\csdef{db@t@Body}{%
  \db@ifvis{kicker}{\db@r{kicker}{kicker}}{}%
  \db@r{stamp}{stamp}%
  \ifdefstring{\db@variant}{image-text}{%
    \db@r{arttall}{placeholder}\db@r{note}{caption}\db@r{para}{body}%
  }{\ifdefstring{\db@variant}{ledger}{%
    \db@r{table}{table}\db@r{label}{noteTag}\db@r{note}{note2}%
  }{\ifdefstring{\db@variant}{quotes}{%
    \db@r{quote}{quotes}\vfill\db@r{note}{note}%
  }{\ifdefstring{\db@variant}{checklist}{%
    \db@r{para}{body2}\begin{db@frame}\db@bar{\db@val{checkTitle}}{}\db@r{check}{checklist}\end{db@frame}%
  }{% columns
    \db@r{label}{proseLabel}\db@r{para}{body2}}}}}}

\csdef{db@t@Photo Essay}{%
  \ifdefstring{\db@variant}{hero}{%
    \db@r{brand}{title}\db@r{lead}{dek}\db@slot{96mm}{\db@val{ph1}}\vspace{0.6\db@gap}\db@r{note}{capA}%
  }{%
    \db@r{photo}{ph2}\hfill\db@r{photo}{ph3}\par\vspace{2mm}\db@r{photo}{ph4}\hfill\db@r{photo}{ph1}\par
    \vspace{\db@gap}\db@r{note}{capA}}}

\csdef{db@t@Opinion}{%
  \db@kindtagbar{tag}{meta}\db@skip{tag}\db@skip{meta}%
  \db@r{head}{title}\db@r{para}{body}\vfill\db@r{quote}{quote}\db@r{note}{promise}\db@r{note}{note}}

\csdef{db@t@Comic}{%
  \ifdefstring{\db@variant}{guest}{%
    \db@kindtagbar{guestTag}{}\db@skip{guestTag}\db@slot{150mm}{\db@val{guestText}}\db@skip{guestText}%
  }{%
    \db@ifvis{title}{\db@r{brand}{title}}{}\db@r{label}{sub}\db@r{panels}{panels}%
    \db@ifvis{endText}{{\db@label\color{DBAccent}\db@caps{\db@val{endText}}\par}}{}\db@skip{endText}%
    \vfill\db@r{note}{endNote}\db@r{note}{credit}}}

\csdef{db@t@Interview}{%
  \ifdefstring{\db@variant}{qa}{%
    \db@r{qa}{qa}\vfill\db@r{note}{footNote}%
  }{%
    \db@r{kicker}{kicker}\db@r{head}{title}\db@slot{70mm}{\db@val{placeholder}}\db@skip{placeholder}%
    \vspace{0.5\db@gap}\db@r{note}{caption}\vspace{\db@gap}\db@r{quote}{quote}}}

\csdef{db@t@Poetry}{\db@r{kicker}{kicker}\db@r{lines}{poems}}

\csdef{db@t@Insert}{%
  \ifdefstring{\db@variant}{stickers}{%
    \db@r{brand}{brand}\db@r{label}{brandSub}\vspace{\db@gap}\db@r{stickers}{stickers}\vfill\db@r{note}{ripTag}%
  }{\ifdefstring{\db@variant}{colouring}{%
    \db@r{head}{title}\db@r{meta}{edition}\db@slot{118mm}{\db@val{brief}}\db@skip{brief}\vspace{0.4\db@gap}%
    \db@r{note}{figLabel}\vfill{\db@label\db@caps{\db@val{crayonLabel}}\ \tikz{\foreach \c/\i in {RipPink/0,RipOrange/1,RipTeal/2,RipInk/3}{\fill[\c](\i*7mm,0)rectangle++(5mm,4mm);}}\par}%
    \db@skip{crayonLabel}\db@r{note}{crayonNote}%
  }{\ifdefstring{\db@variant}{art}{%
    \db@slot{170mm}{\db@val{placeholder}}\db@skip{placeholder}\vfill\db@r{note}{credit}%
  }{% artist
    \db@r{kicker}{kicker}\db@r{para}{bio}\vfill%
    \begin{db@frame}\db@bar{\db@val{submitTitle}}{}\db@skip{submitTitle}%
      {\db@bodysize\db@each{submitRows}{\noindent▸\ \db@item\par\db@dash}}\db@skip{submitRows}\end{db@frame}}}}}

\csdef{db@t@Lab}{%
  \ifdefstring{\db@variant}{status}{%
    \begin{db@frame}\db@bar{\db@val{statusLabel}}{\db@val{statusTag}}\db@skip{statusLabel}\db@skip{statusTag}%
      {\db@bodysize\db@each{status}{\db@fields\noindent\parbox[t]{\dimexpr\linewidth-19mm}{\RaggedRight\db@fa}\hfill\parbox[t]{17mm}{\raggedleft\db@chip{DBRow}{\db@fb}}\par\db@dash}}\db@skip{status}\end{db@frame}%
    \db@r{label}{whyTitle}\db@r{para}{whyBody}\vfill\db@r{note}{footNote}%
  }{%
    \noindent\includegraphics[width=38mm]{\dbassets../tools/latex/assets/logo.pdf}\par\vspace{0.3\db@gap}%
    \db@r{label}{logoSub}\db@r{stamp}{stamp}\db@r{head}{title}\db@r{para}{body}\vfill\db@r{sign}{sig}}}

\csdef{db@t@Review}{%
  \ifdefstring{\db@variant}{advice}{%
    \db@r{brand}{brand}\db@r{label}{brandSub}\db@r{advice}{advice}%
  }{\ifdefstring{\db@variant}{cards}{%
    \db@r{kicker}{kicker}\db@r{stamp}{stamp}\db@r{cards}{cards}\vfill\db@r{note}{blurb}%
  }{\ifdefstring{\db@variant}{critique}{%
    \db@r{brand}{brand}\db@r{label}{brandSub}\db@r{cards}{features}\vfill%
    \begin{db@frame}\db@bar{\db@val{rulesTag}}{}\db@skip{rulesTag}{\db@xs\db@val{rules}\par}\db@skip{rules}\end{db@frame}%
  }{% playlist
    \db@r{kicker}{kicker}\db@r{brand}{rotTitle}%
    \begin{db@frame}\db@bar{\db@val{rotLabel}}{\db@val{rotTag}}\db@skip{rotLabel}\db@skip{rotTag}%
      {\db@bodysize\db@each{tracks}{\db@fields\noindent{\bfseries\db@fa}\hfill{\db@xs\color{DBMuted}\db@caps{\db@fb}}\par\db@dash}}\db@skip{tracks}\end{db@frame}%
    \vfill\db@slot{30mm}{\db@val{qrNote}}\db@skip{qrNote}\db@r{note}{qrSub}}}}}

\csdef{db@t@Listings}{%
  \ifdefstring{\db@variant}{program}{%
    \db@r{kicker}{kicker}\db@r{brand}{brand}\db@r{label}{brandSub}\db@r{para}{intro}%
    \begin{db@frame}\db@bar{\db@val{boxLabel}}{\db@val{boxTag}}\db@skip{boxLabel}\db@skip{boxTag}%
      {\db@bodysize\justifying\db@each{notes}{\db@fields\noindent{\bfseries\db@fa}\ — \db@fb\par\db@dash}}\db@skip{notes}\end{db@frame}%
    \vfill\db@r{label}{bringTag}\db@r{note}{bring}%
  }{\ifdefstring{\db@variant}{screenings}{%
    \db@r{kicker}{kicker}\db@r{label}{schedLabel}%
    \begin{db@frame}\db@bar{\db@val{boxLabel}}{\db@val{schedTag}}\db@skip{boxLabel}\db@skip{schedTag}\db@r{rows}{rows}\end{db@frame}\db@skip{rows}%
    \db@r{note}{schedFoot}\vfill%
    \begin{db@frame}[colback=RipTeal!18!DBPaper]\db@bar{\db@val{voteTitle}}{}\db@skip{voteTitle}%
      {\db@bodysize\db@each{votes}{\noindent{\color{DBAccent}☐}\ \db@item\par\db@dash}}\db@skip{votes}{\db@xs\color{DBMuted}\db@val{voteNote}\par}\db@skip{voteNote}\end{db@frame}%
    \db@r{note}{footNote}%
  }{\ifdefstring{\db@variant}{calendar}{%
    \db@r{head}{title}%
    \begin{db@frame}\db@bar{\db@val{boxLabel}}{\db@val{boxTag}}\db@skip{boxLabel}\db@skip{boxTag}%
      {\db@bodysize\db@each{rows}{\db@fields\noindent\db@chip{DBAccent}{\db@fa}\ {\bfseries\db@fb}\par{\db@xs\color{DBMuted}\db@ftail}\par\db@dash}}\db@skip{rows}\end{db@frame}%
    \vfill\db@r{note}{footNote}%
  }{\ifdefstring{\db@variant}{directory}{%
    \db@r{kicker}{dirKicker}%
    \begin{db@frame}\db@bar{\db@val{boxLabel}}{\db@val{boxTag}}\db@skip{boxLabel}\db@skip{boxTag}%
      {\db@bodysize\db@each{rows}{\db@fields\noindent{\bfseries\db@fa}\par{\db@xs\color{DBMuted}\db@fb}\par\db@dash}}\db@skip{rows}\end{db@frame}%
    \vfill\db@r{note}{footNote}%
  }{% mail
    \db@r{brand}{brand}\db@r{label}{brandSub}\begin{db@frame}[colback=DBPad]{\db@bodysize\justifying\db@val{intro}\par}\db@skip{intro}\end{db@frame}%
    \vfill\db@slot{34mm}{\db@val{qrNote}}\db@skip{qrNote}\db@r{note}{qrSub}}}}}}

\csdef{db@t@Colophon}{%
  \ifdefstring{\db@variant}{ad}{%
    \begin{db@frame}[colback=RipOrange!25!DBPaper]{\db@bodysize\justifying\db@val{adText}\par}\db@skip{adText}\end{db@frame}%
    \vfill{\db@hsize\color{DBAccent}\db@caps{\db@val{slogan}}\par}\db@skip{slogan}\vspace{\db@gap}\db@r{sign}{sig}%
  }{%
    \db@r{brand}{brand}\db@slot{44mm}{\db@val{placeholder}}\db@skip{placeholder}\vspace{0.4\db@gap}\db@r{note}{caption}%
    \begin{db@frame}\db@bar{\db@val{creditsLabel}}{}\db@skip{creditsLabel}%
      {\db@bodysize\db@each{credits}{\db@fields\noindent\parbox[t]{24mm}{\db@xs\color{DBMuted}\db@caps{\db@fa}}\parbox[t]{\dimexpr\linewidth-24mm}{\RaggedRight\bfseries\db@fb}\par\db@dash}}\db@skip{credits}\end{db@frame}%
    \vfill\db@r{note}{colophon}}}
