namespace :feature_flags do
  desc "Enable send_requests_directly_to_freeswitch for specified companies"
  task :enable_freeswitch, [:company_ids, :dry_run] => :environment do |t, args|
    if args[:company_ids].blank?
      puts "Error: Please provide company IDs"
      puts "Usage: rake feature_flags:enable_freeswitch['id1,id2,id3',dry_run]"
      puts "       rake feature_flags:enable_freeswitch['id1,id2,id3']  # actual run"
      exit 1
    end

    dry_run = args[:dry_run] == 'dry_run'
    company_ids = args[:company_ids].split(',').map(&:strip)
    companies_to_update = Company.where(id: company_ids)

    if dry_run
      puts "DRY RUN MODE - No changes will be made"
    end

    puts "Found #{companies_to_update.count} companies to update"

    companies_to_update.find_each do |company|
      if dry_run
        puts "Would enable freeswitch for company: #{company.id} (#{company.name})"
      else
        company.update!(
          trust_allowance_overrides: company.trust_allowance_overrides.merge(
            "send_requests_directly_to_freeswitch" => true
          )
        )
        print "."
      end
    end

    if dry_run
      puts "\nDry run complete. No changes were made."
    else
      puts "\nSuccessfully updated #{companies_to_update.count} companies"
    end
  end

  desc "Rollback send_requests_directly_to_freeswitch for specified companies"
  task :rollback_freeswitch, [:company_ids, :dry_run] => :environment do |t, args|
    if args[:company_ids].blank?
      puts "Error: Please provide company IDs"
      puts "Usage: rake feature_flags:rollback_freeswitch['id1,id2,id3',dry_run]"
      puts "       rake feature_flags:rollback_freeswitch['id1,id2,id3']  # actual run"
      exit 1
    end

    dry_run = args[:dry_run] == 'dry_run'
    company_ids = args[:company_ids].split(',').map(&:strip)
    companies_to_update = Company.where(id: company_ids)

    if dry_run
      puts "DRY RUN MODE - No changes will be made"
    end

    puts "Found #{companies_to_update.count} companies to process"

    companies_to_update.find_each do |company|
      if company.trust_allowance_overrides.key?('send_requests_directly_to_freeswitch')
        if dry_run
          puts "Would remove freeswitch override for #{company.name} (#{company.id})"
        else
          company.trust_allowance_overrides.delete('send_requests_directly_to_freeswitch')
          company.save!
          puts "Removed override for #{company.name}"
        end
      else
        if dry_run
          puts "No override found for #{company.name} (#{company.id}) - would skip"
        else
          puts "No override found for #{company.name}"
        end
      end
    end

    if dry_run
      puts "\nDry run complete. No changes were made."
    else
      puts "\nRollback complete"
    end
  end
end