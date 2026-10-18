set f to POSIX file "/Users/diegooliveira/Desktop/lotes_importados.numbers"

tell application "Numbers"
	open f
	delay 1
	tell front document
		tell sheet 1
			tell table 1
				set rc to row count
				set cc to column count
				set outputText to ""
				repeat with r from 1 to rc
					set rowIndex to contents of r
					set lineText to ""
					repeat with c from 1 to cc
						set columnIndex to contents of c
						if columnIndex > 1 then set lineText to lineText & "|"
						set lineText to lineText & (formatted value of cell columnIndex of row rowIndex as text)
					end repeat
					set outputText to outputText & lineText & linefeed
				end repeat
			end tell
		end tell
	end tell
end tell

return outputText
